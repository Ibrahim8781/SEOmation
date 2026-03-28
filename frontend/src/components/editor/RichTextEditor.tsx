import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';
import {
  FiBold,
  FiCode,
  FiEye,
  FiFileText,
  FiItalic,
  FiLink,
  FiList,
  FiRotateCcw,
  FiRotateCw,
  FiType
} from 'react-icons/fi';
import { Textarea } from '@/components/ui/Textarea';
import type { SupportedLanguage } from '@/utils/languages';
import { getTextSurfaceProps } from '@/utils/languagePresentation';
import './richTextEditor.css';

type EditorMode = 'write' | 'preview' | 'html';

type RichTextEditorProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  error?: string;
  language?: SupportedLanguage | string | null;
};

const editorModes: { value: EditorMode; label: string; icon: ReactNode }[] = [
  { value: 'write', label: 'Write', icon: <FiType /> },
  { value: 'preview', label: 'Preview', icon: <FiEye /> },
  { value: 'html', label: 'HTML', icon: <FiFileText /> }
];

export function RichTextEditor({ label, value, onChange, helperText, error, language }: RichTextEditorProps) {
  const [mode, setMode] = useState<EditorMode>('write');
  const plainText = useMemo(() => normalizeText(value), [value]);
  const wordCount = useMemo(() => countWords(plainText), [plainText]);
  const readingTime = useMemo(() => Math.max(1, Math.ceil(wordCount / 220)), [wordCount]);
  const textSurfaceProps = useMemo(() => getTextSurfaceProps(language), [language]);
  const htmlSurfaceProps = useMemo(() => getTextSurfaceProps(language, { code: true }), [language]);
  const sanitizedPreview = useMemo(() => {
    const safeHtml = value?.trim() ? value : '<p>No content yet. Switch to Write and start editing.</p>';
    return DOMPurify.sanitize(safeHtml);
  }, [value]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank'
        }
      }),
      Placeholder.configure({
        placeholder: 'Write your article here...'
      })
    ],
    content: value || '<p></p>',
    editorProps: {
      attributes: {
        class: 'rich-editor__content'
      }
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      if (html !== value) {
        onChange(html);
      }
    },
    immediatelyRender: false
  });

  useEffect(() => {
    if (!editor) return;
    const nextValue = value?.trim() ? value : '<p></p>';
    const currentValue = editor.getHTML();
    if (currentValue !== nextValue) {
      editor.commands.setContent(nextValue, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    dom.setAttribute('lang', textSurfaceProps.lang);
    dom.setAttribute('dir', textSurfaceProps.dir);
    dom.dataset.script = textSurfaceProps['data-script'];
    dom.dataset.textDir = textSurfaceProps['data-text-dir'];
  }, [editor, textSurfaceProps]);

  return (
    <div className={clsx('ui-field', 'rich-editor', error && 'ui-field--error')}>
      {label && <label className="ui-field__label">{label}</label>}

      <div className="rich-editor__shell">
        <div className="rich-editor__topbar">
          <div className="rich-editor__toolbar">
            <ToolbarButton
              editor={editor}
              label="Paragraph"
              active={editor?.isActive('paragraph') ?? false}
              onClick={() => editor?.chain().focus().setParagraph().run()}
            />
            <ToolbarButton
              editor={editor}
              label="H1"
              active={editor?.isActive('heading', { level: 1 }) ?? false}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            />
            <ToolbarButton
              editor={editor}
              label="H2"
              active={editor?.isActive('heading', { level: 2 }) ?? false}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            />
            <ToolbarButton
              editor={editor}
              label="H3"
              active={editor?.isActive('heading', { level: 3 }) ?? false}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            />
            <ToolbarButton
              editor={editor}
              icon={<FiBold />}
              label="Bold"
              active={editor?.isActive('bold') ?? false}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
              editor={editor}
              icon={<FiItalic />}
              label="Italic"
              active={editor?.isActive('italic') ?? false}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
              editor={editor}
              icon={<FiList />}
              label="Bullet list"
              active={editor?.isActive('bulletList') ?? false}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
              editor={editor}
              label="Ordered list"
              active={editor?.isActive('orderedList') ?? false}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            />
            <ToolbarButton
              editor={editor}
              icon={<FiCode />}
              label="Code block"
              active={editor?.isActive('codeBlock') ?? false}
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            />
            <ToolbarButton
              editor={editor}
              icon={<FiLink />}
              label="Link"
              active={editor?.isActive('link') ?? false}
              onClick={() => promptForLink(editor)}
            />
            <ToolbarButton
              editor={editor}
              icon={<FiRotateCcw />}
              label="Undo"
              active={false}
              onClick={() => editor?.chain().focus().undo().run()}
            />
            <ToolbarButton
              editor={editor}
              icon={<FiRotateCw />}
              label="Redo"
              active={false}
              onClick={() => editor?.chain().focus().redo().run()}
            />
          </div>

          <div className="rich-editor__modes">
            {editorModes.map((item) => (
              <button
                key={item.value}
                type="button"
                className={clsx('rich-editor__mode', mode === item.value && 'is-active')}
                onClick={() => setMode(item.value)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rich-editor__stage">
          {mode === 'write' && <EditorContent editor={editor} />}
          {mode === 'preview' && (
            <div
              className={clsx('rich-editor__preview', 'text-surface', !stripHtml(value).trim() && 'is-empty')}
              {...textSurfaceProps}
              dangerouslySetInnerHTML={{ __html: sanitizedPreview }}
            />
          )}
          {mode === 'html' && (
            <Textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              rows={14}
              helperText="Advanced mode. Direct HTML edits sync back into the rich text editor."
              {...htmlSurfaceProps}
            />
          )}
        </div>

        <div className="rich-editor__footer">
          <div className="rich-editor__stats">
            <span>{wordCount} words</span>
            <span>{plainText.length} characters</span>
            <span>{readingTime} min read</span>
          </div>
          <span className="rich-editor__hint">
            {mode === 'html' ? 'Raw HTML mode syncs back into the editor.' : 'Formatting updates live.'}
          </span>
        </div>
      </div>

      {(error || helperText) && (
        <p className={clsx('ui-field__message', error && 'ui-field__message--error')}>
          {error || helperText}
        </p>
      )}
    </div>
  );
}

function ToolbarButton({
  editor,
  label,
  onClick,
  active,
  icon
}: {
  editor: Editor | null;
  label: string;
  onClick: () => void;
  active: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={clsx('rich-editor__tool', active && 'is-active')}
      onClick={onClick}
      disabled={!editor}
      title={label}
      aria-label={label}
    >
      {icon ?? <span>{label}</span>}
      {icon && <span className="rich-editor__sr-only">{label}</span>}
    </button>
  );
}

function promptForLink(editor: Editor | null) {
  if (!editor) return;
  const previousUrl = editor.getAttributes('link').href ?? '';
  const nextUrl = window.prompt('Enter link URL (https:// will be added if omitted)', previousUrl);

  if (nextUrl === null) return;

  const normalizedUrl = normalizeLinkUrl(nextUrl);
  if (!normalizedUrl) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }

  editor.chain().focus().extendMarkRange('link').setLink({ href: normalizedUrl }).run();
}

function stripHtml(value: string) {
  return String(value || '').replace(/<[^>]+>/g, ' ');
}

function normalizeText(value: string) {
  return stripHtml(value).replace(/\s+/g, ' ').trim();
}

function countWords(value: string) {
  if (!value) return 0;
  return value.split(/\s+/).filter(Boolean).length;
}

function normalizeLinkUrl(value: string) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(normalized) ||
    normalized.startsWith('//') ||
    normalized.startsWith('/') ||
    normalized.startsWith('./') ||
    normalized.startsWith('../') ||
    normalized.startsWith('#')
  ) {
    return normalized;
  }

  if (/^(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:[/:?#].*)?$/i.test(normalized)) {
    return `https://${normalized}`;
  }

  return normalized;
}
