import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { type FC, useCallback, useEffect } from 'react';

export interface RichEditorProps {
  content?: string;
  placeholder?: string;
  onChange?: (html: string, text: string) => void;
  onFocus?: () => void;
  editable?: boolean;
  className?: string;
  editorClassName?: string;
}

export const RichEditor: FC<RichEditorProps> = ({
  content = '',
  placeholder = 'Start writing...',
  onChange,
  onFocus,
  editable = true,
  className = '',
  editorClassName = '',
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Typography, // smart quotes, em-dashes, etc.
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getHTML(), e.getText());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none outline-none min-h-[200px] px-3 py-3 focus:outline-none',
      },
    },
  });

  // Sync content when prop changes
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== content) {
      editor.commands.setContent(content || '');
    }
  }, [editor, content]);

  const handleFocus = useCallback(() => {
    onFocus?.();
  }, [onFocus]);

  return (
    <div className={`rich-editor ${className}`} onFocus={handleFocus}>
      <EditorContent editor={editor} className={editorClassName} />
    </div>
  );
};

// Hook to access editor instance from outside
export function useRichEditor() {
  return { RichEditor };
}