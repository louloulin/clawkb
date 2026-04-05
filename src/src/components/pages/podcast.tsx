import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Mic, Square, Play, Download, RefreshCw,
  Loader2, ChevronDown, ChevronUp, Plus, Trash2,
  Settings2, User, FileText, Copy, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { api } from '@/api/commands';

// Podcast script segment
interface PodcastSegment {
  id: string;
  speaker: 'host' | 'guest';
  text: string;
  duration?: number; // estimated seconds
}

interface TtsConfig {
  voice: string;
  rate: number;      // 0.5 - 2.0
  pitch: number;     // 0.5 - 2.0
  volume: number;    // 0.0 - 1.0
}

const VOICES: Record<string, { label: string; lang: string; gender: 'male' | 'female' }> = {};

function detectVoices(): void {
  if (!window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  for (const v of voices) {
    const key = `${v.lang}-${v.name}`;
    VOICES[key] = {
      label: v.name,
      lang: v.lang,
      gender: v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman')
        ? 'female' : 'male',
    };
  }
}

function getAvailableVoices(): Array<{ key: string; label: string; lang: string; gender: string }> {
  if (!window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices();
  if (Object.keys(VOICES).length === 0) detectVoices();
  return voices.map(v => ({
    key: v.voiceURI || v.name,
    label: v.name,
    lang: v.lang,
    gender: v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman')
      ? 'female' : 'male',
  }));
}

function buildPodcastScript(
  topic: string,
  hostName: string,
  guestName: string,
  kbContent: string,
  customIntro?: string,
): PodcastSegment[] {
  const segments: PodcastSegment[] = [];
  const safeTopic = topic.trim();

  // Opening
  const openingText = customIntro
    || `${hostName}：大家好，欢迎收听本期播客！我是${hostName}，今天我们来聊聊「${safeTopic}」。`;
  segments.push({ id: 'open', speaker: 'host', text: openingText });

  // Parse KB content into discussion points
  const points: string[] = [];
  if (kbContent) {
    // Split by double newlines or numbered items
    const lines = kbContent.split(/\n+/).filter(l => l.trim().length > 20);
    for (const line of lines.slice(0, 8)) {
      // Skip very long lines (likely full text blocks)
      if (line.trim().length < 200) {
        points.push(line.trim());
      }
    }
  }

  // Add discussion segments alternating host/guest
  if (points.length > 0) {
    for (let i = 0; i < Math.min(points.length, 6); i++) {
      const p = points[i];
      const speaker = i % 2 === 0 ? 'host' : 'guest';
      const speakerName = speaker === 'host' ? hostName : guestName;
      segments.push({
        id: `pt-${i}`,
        speaker,
        text: `${speakerName}：${p}`,
      });
    }
  } else {
    // No KB content — generate from topic alone
    segments.push({
      id: 'pt-0',
      speaker: 'guest',
      text: `${guestName}：关于「${safeTopic}」，这是一个非常有意义的话题。首先...（这里将使用知识库中的相关内容展开讨论）`,
    });
    segments.push({
      id: 'pt-1',
      speaker: 'host',
      text: `${hostName}：说得很好！让我们深入聊一聊...`,
    });
  }

  // Closing
  segments.push({
    id: 'close',
    speaker: 'host',
    text: `${hostName}：感谢大家的收听！如果对这个话题有任何想法，欢迎在评论区留言，我们下期再见！`,
  });

  return segments;
}

function estimateDuration(text: string): number {
  // Rough estimate: ~3 chars per second for Chinese speech
  return Math.ceil(text.length / 3);
}

// Audio recording via MediaRecorder API
class PodcastRecorder {
  private audioCtx: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async setup(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioCtx = new AudioContext();
    this.destination = this.audioCtx.createMediaStreamDestination();
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    source.connect(this.destination);
  }

  start(): void {
    if (!this.destination || !this.stream) return;
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.destination.stream, {
      mimeType: 'audio/webm;codecs=opus',
    });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(new Blob([], { type: 'audio/webm' }));
        return;
      }
      this.mediaRecorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: 'audio/webm' }));
      };
      this.mediaRecorder.stop();
    });
  }

  destroy(): void {
    this.mediaRecorder?.stop();
    this.stream?.getTracks().forEach(t => t.stop());
    this.audioCtx?.close();
  }
}

export function PodcastPage() {
  const [topic, setTopic] = useState('');
  const [hostName, setHostName] = useState('小播');
  const [guestName, setGuestName] = useState('嘉宾');
  const [introText, setIntroText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [segments, setSegments] = useState<PodcastSegment[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [, setSpeechUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [ttsConfig, setTtsConfig] = useState<TtsConfig>({
    voice: '',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
  });
  const [availableVoices, setAvailableVoices] = useState<Array<{ key: string; label: string; lang: string; gender: string }>>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [showAddSegment, setShowAddSegment] = useState(false);
  const [newSegmentText, setNewSegmentText] = useState('');
  const [newSegmentSpeaker, setNewSegmentSpeaker] = useState<'host' | 'guest'>('host');
  const [kbContent, setKbContent] = useState('');
  const [copied, setCopied] = useState(false);

  const recorderRef = useRef<PodcastRecorder | null>(null);

  // Load available voices
  useEffect(() => {
    if (window.speechSynthesis) {
      const loadVoices = () => {
        const voices = getAvailableVoices();
        setAvailableVoices(voices);
        if (voices.length > 0 && !ttsConfig.voice) {
          setTtsConfig(prev => ({ ...prev, voice: voices[0].key }));
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const searchKbForTopic = useCallback(async (q: string): Promise<string> => {
    if (!q.trim()) return '';
    try {
      const hits = await api.search(q, 8, 'hybrid');
      return hits.map(h => `【${h.title}】${h.content?.slice(0, 300) || ''}`).join('\n\n');
    } catch {
      return '';
    }
  }, []);

  const handleGenerateScript = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      const content = await searchKbForTopic(topic);
      setKbContent(content);
      const script = buildPodcastScript(topic, hostName, guestName, content, introText);
      setSegments(script);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateSegment = async (id: string) => {
    if (!topic.trim() || !kbContent) return;
    const idx = segments.findIndex(s => s.id === id);
    if (idx < 0) return;

    const newSegments = [...segments];
    newSegments[idx] = {
      ...newSegments[idx],
      text: `[重新生成中...]`,
    };
    setSegments(newSegments);

    // In a full implementation, we would call the LLM here to regenerate this specific segment
    // For now, just mark it as generated
    setTimeout(() => {
      setSegments(prev => prev.map(s =>
        s.id === id ? { ...s, text: `（${s.speaker === 'host' ? hostName : guestName}继续说道...）` } : s
      ));
    }, 500);
  };

  const speakSegment = useCallback((segment: PodcastSegment) => {
    if (!window.speechSynthesis) {
      alert('当前浏览器不支持语音合成');
      return;
    }

    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.lang = 'zh-CN';
    utterance.rate = ttsConfig.rate;
    utterance.pitch = ttsConfig.pitch;
    utterance.volume = ttsConfig.volume;

    if (ttsConfig.voice) {
      const voice = window.speechSynthesis.getVoices().find(
        v => v.voiceURI === ttsConfig.voice || v.name === ttsConfig.voice
      );
      if (voice) utterance.voice = voice;
    }

    utterance.onstart = () => setPlayingId(segment.id);
    utterance.onend = () => setPlayingId(null);
    utterance.onerror = () => setPlayingId(null);

    setSpeechUtterance(utterance);
    window.speechSynthesis.speak(utterance);
  }, [ttsConfig]);

  const stopSpeech = () => {
    window.speechSynthesis?.cancel();
    setPlayingId(null);
    setSpeechUtterance(null);
  };

  const handlePlayAll = async () => {
    if (segments.length === 0) return;

    for (const seg of segments) {
      if (!window.speechSynthesis) break;
      speakSegment(seg);
      // Wait for speech to end before next segment
      await new Promise<void>((resolve) => {
        const checkEnd = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            clearInterval(checkEnd);
            resolve();
          }
        }, 100);
        setTimeout(() => { clearInterval(checkEnd); resolve(); }, 30000);
      });
    }
  };

  const handleStartRecording = async () => {
    try {
      const recorder = new PodcastRecorder();
      await recorder.setup();
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);

      // Start playing all segments
      handlePlayAll();
    } catch (e) {
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  const handleStopRecording = async () => {
    if (!recorderRef.current) return;
    const blob = await recorderRef.current.stop();
    recorderRef.current.destroy();
    recorderRef.current = null;
    setRecordedBlob(blob);
    setRecording(false);
    stopSpeech();
  };

  const handleDownloadRecording = () => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `podcast-${topic.replace(/\s+/g, '_') || 'recording'}-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddSegment = () => {
    if (!newSegmentText.trim()) return;
    const speakerName = newSegmentSpeaker === 'host' ? hostName : guestName;
    setSegments(prev => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        speaker: newSegmentSpeaker,
        text: `${speakerName}：${newSegmentText.trim()}`,
      },
    ]);
    setNewSegmentText('');
    setShowAddSegment(false);
  };

  const handleDeleteSegment = (id: string) => {
    setSegments(prev => prev.filter(s => s.id !== id));
  };

  const handleCopyScript = () => {
    const text = segments.map(s => {
      const name = s.speaker === 'host' ? hostName : guestName;
      return `${name}：${s.text.replace(/^[^\s：]+：/, '')}`;
    }).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalDuration = segments.reduce((acc, s) => acc + estimateDuration(s.text), 0);
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b shrink-0">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" />
          Podcast Studio
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          基于知识库内容生成播客脚本并语音朗读
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: config */}
        <div className="w-80 border-r flex flex-col shrink-0 overflow-auto">
          <div className="p-4 space-y-4">
            {/* Topic */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">播客主题</Label>
              <Input
                placeholder="例如：人工智能在教育领域的应用"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Speakers */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <User className="h-3 w-3" /> 主持人
                </Label>
                <Input
                  value={hostName}
                  onChange={e => setHostName(e.target.value)}
                  placeholder="主持人名"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <User className="h-3 w-3" /> 嘉宾
                </Label>
                <Input
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  placeholder="嘉宾名"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Custom intro */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">自定义开场白（可选）</Label>
              <Textarea
                placeholder="留空则自动生成开场白..."
                value={introText}
                onChange={e => setIntroText(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerateScript}
              disabled={!topic.trim() || generating}
              className="w-full gap-1.5"
              size="sm"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <SparklesIcon className="h-3.5 w-3.5" />
              )}
              {generating ? '从知识库生成...' : '生成播客脚本'}
            </Button>

            {/* TTS Settings */}
            <div className="border-t pt-3">
              <button
                onClick={() => setShowSettings(s => !s)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                <Settings2 className="h-3 w-3" />
                语音设置
                {showSettings ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
              </button>

              {showSettings && (
                <div className="space-y-3">
                  {/* Voice selection */}
                  <div className="space-y-1">
                    <Label className="text-xs">语音</Label>
                    <Select value={ttsConfig.voice} onValueChange={v => setTtsConfig(p => ({ ...p, voice: v }))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="选择语音..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVoices.length === 0 && (
                          <SelectItem value="default">浏览器默认</SelectItem>
                        )}
                        {availableVoices.map(v => (
                          <SelectItem key={v.key} value={v.key}>
                            {v.label} ({v.lang})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Rate */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">语速</Label>
                      <span className="text-[10px] text-muted-foreground">{ttsConfig.rate.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={ttsConfig.rate}
                      onChange={e => setTtsConfig(p => ({ ...p, rate: parseFloat(e.target.value) }))}
                      className="w-full h-1.5 accent-primary"
                    />
                  </div>

                  {/* Pitch */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">音调</Label>
                      <span className="text-[10px] text-muted-foreground">{ttsConfig.pitch.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={ttsConfig.pitch}
                      onChange={e => setTtsConfig(p => ({ ...p, pitch: parseFloat(e.target.value) }))}
                      className="w-full h-1.5 accent-primary"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* KB info */}
            {kbContent && (
              <div className="border-t pt-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  引用知识库内容
                </div>
                <p className="text-[10px] text-muted-foreground line-clamp-3 bg-muted/50 rounded p-2">
                  {kbContent.slice(0, 200)}...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right panel: script editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Script toolbar */}
          <div className="px-4 py-2 border-b flex items-center gap-2 shrink-0">
            {segments.length > 0 && (
              <>
                <Button
                  onClick={playingId ? stopSpeech : handlePlayAll}
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-xs"
                >
                  {playingId ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {playingId ? '停止' : '播放全部'}
                </Button>

                {!recording ? (
                  <Button
                    onClick={handleStartRecording}
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 text-xs"
                    title="边播放边录音"
                  >
                    <Mic className="h-3 w-3 text-red-500" />
                    开始录音
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopRecording}
                    size="sm"
                    className="gap-1.5 h-7 text-xs bg-red-500 hover:bg-red-600"
                  >
                    <Square className="h-3 w-3" />
                    停止录音
                  </Button>
                )}

                {recordedBlob && (
                  <Button
                    onClick={handleDownloadRecording}
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 text-xs"
                  >
                    <Download className="h-3 w-3" />
                    下载录音
                  </Button>
                )}

                <Button
                  onClick={handleCopyScript}
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 h-7 text-xs ml-auto"
                >
                  {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? '已复制' : '复制脚本'}
                </Button>

                <Button
                  onClick={() => setShowAddSegment(true)}
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 h-7 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  添加
                </Button>
              </>
            )}

            {segments.length === 0 && !generating && (
              <p className="text-xs text-muted-foreground">
                设置主题后点击「生成播客脚本」，知识库内容将自动编排成对话
              </p>
            )}

            {recording && (
              <div className="ml-auto flex items-center gap-1.5 text-xs text-red-500">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                录音中...
              </div>
            )}
          </div>

          {/* Add segment form */}
          {showAddSegment && (
            <div className="px-4 py-2 border-b bg-muted/30 flex gap-2 items-end shrink-0">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">添加对话</Label>
                <Input
                  value={newSegmentText}
                  onChange={e => setNewSegmentText(e.target.value)}
                  placeholder="输入对话内容..."
                  className="h-8 text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleAddSegment()}
                />
              </div>
              <Select value={newSegmentSpeaker} onValueChange={v => setNewSegmentSpeaker(v as 'host' | 'guest')}>
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="host">{hostName}</SelectItem>
                  <SelectItem value="guest">{guestName}</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleAddSegment} className="h-8">添加</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddSegment(false)} className="h-8">取消</Button>
            </div>
          )}

          {/* Script segments */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {segments.length === 0 && !generating && (
                <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
                  <Mic className="h-12 w-12 text-muted-foreground/30" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">暂无脚本</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      输入播客主题，从知识库生成脚本
                    </p>
                  </div>
                </div>
              )}

              {generating && (
                <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">从知识库搜索相关内容...</span>
                </div>
              )}

              {segments.map((seg, i) => (
                <div key={seg.id} className="group relative">
                  <div className={`flex gap-3 p-3 rounded-xl border transition-colors ${
                    playingId === seg.id
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-transparent hover:border-border hover:bg-muted/30'
                  }`}>
                    {/* Speaker avatar */}
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium mt-0.5 ${
                      seg.speaker === 'host'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                    }`}>
                      {seg.speaker === 'host' ? hostName[0] : guestName[0]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">
                          {seg.speaker === 'host' ? hostName : guestName}
                        </span>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                          #{i + 1}
                        </Badge>
                        {seg.duration && (
                          <span className="text-[10px] text-muted-foreground">
                            ~{formatDuration(seg.duration)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {seg.text}
                      </p>
                    </div>

                    {/* Segment controls */}
                    <div className="flex items-start gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => playingId === seg.id ? stopSpeech() : speakSegment(seg)}
                      >
                        {playingId === seg.id
                          ? <Square className="h-3 w-3" />
                          : <Play className="h-3 w-3" />
                        }
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleRegenerateSegment(seg.id)}
                        title="重新生成"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-400 hover:text-red-500"
                        onClick={() => handleDeleteSegment(seg.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Stats footer */}
              {segments.length > 0 && (
                <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground border-t">
                  <span>{segments.length} 个对话段</span>
                  <span>预计时长 ~{formatDuration(totalDuration)}</span>
                  {recording && <span className="text-red-500">录音进行中</span>}
                  {recordedBlob && (
                    <span className="text-green-500">
                      已录音 {formatDuration(Math.ceil(recordedBlob.size / 8000))}
                    </span>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

// Inline Sparkles icon to avoid extra imports
function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
    </svg>
  );
}
