import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CaretDown,
  Code,
  CodeBlock,
  ColumnsPlusRight,
  Highlighter,
  LinkSimple,
  ListBullets,
  ListNumbers,
  Minus,
  Quotes,
  RowsPlusBottom,
  Table,
  TextB,
  TextItalic,
  TextStrikethrough,
  Trash,
} from '@phosphor-icons/react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { Highlight } from '@tiptap/extension-highlight'
import { Link } from '@tiptap/extension-link'
import { Markdown } from '@tiptap/markdown'
import { Placeholder } from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type MarkdownWysiwygEditorProps = {
  ariaLabel: string
  onChange: (markdown: string) => void
  onReady?: () => void
  placeholder?: string
  value: string
}

type ToolbarButtonProps = {
  active?: boolean
  children: ReactNode
  disabled?: boolean
  label: string
  onClick: () => void
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

const MarkdownHighlight = Highlight.extend({
  markdownTokenizer: {
    name: 'highlight',
    level: 'inline',
    start: (source) => source.indexOf('=='),
    tokenize: (source, _tokens, lexer) => {
      const match = /^==([^=]+)==/.exec(source)
      if (!match) return undefined

      return {
        type: 'highlight',
        raw: match[0],
        text: match[1],
        tokens: lexer.inlineTokens(match[1]),
      }
    },
  },
  parseMarkdown: (token, helpers) =>
    helpers.applyMark('highlight', helpers.parseInline(token.tokens ?? [])),
  renderMarkdown: (node, helpers) =>
    `==${helpers.renderChildren(node.content ?? [])}==`,
})

const headingOptions: Array<{ label: string; value: 'paragraph' | HeadingLevel }> = [
  { label: '正文', value: 'paragraph' },
  { label: '一级标题', value: 1 },
  { label: '二级标题', value: 2 },
  { label: '三级标题', value: 3 },
  { label: '四级标题', value: 4 },
  { label: '五级标题', value: 5 },
  { label: '六级标题', value: 6 },
]

function normalizeWebUrl(value: string) {
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

function isAllowedWebUrl(value: string) {
  return normalizeWebUrl(value) !== null
}

const SafeLink = Link.extend({
  parseMarkdown: (token, helpers) => {
    const content = helpers.parseInline(token.tokens ?? [])
    const href = normalizeWebUrl(String(token.href ?? ''))
    if (!href) return content

    return helpers.applyMark('link', content, {
      href,
      title: token.title ? String(token.title) : null,
    })
  },
})

function ToolbarButton({ active, children, disabled, label, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={cn('markdown-wysiwyg-tool', active === true && 'is-active')}
      aria-label={label}
      aria-pressed={active}
      data-tooltip={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function ToolbarSeparator() {
  return <span className="markdown-wysiwyg-toolbar-separator" aria-hidden="true" />
}

export function MarkdownWysiwygEditor({
  ariaLabel,
  onChange,
  onReady,
  placeholder = '开始输入内容…',
  value,
}: MarkdownWysiwygEditorProps) {
  const onChangeRef = useRef(onChange)
  const onReadyRef = useRef(onReady)
  const lastEmittedMarkdownRef = useRef(value)
  const initialValueHandledRef = useRef(false)
  const linkInputRef = useRef<HTMLInputElement | null>(null)
  const [linkEditorOpen, setLinkEditorOpen] = useState(false)
  const [linkHref, setLinkHref] = useState('')
  const [linkError, setLinkError] = useState('')
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        link: false,
      }),
      SafeLink.configure({
        autolink: true,
        defaultProtocol: 'https',
        enableClickSelection: true,
        isAllowedUri: isAllowedWebUrl,
        linkOnPaste: true,
        openOnClick: false,
        protocols: ['http', 'https'],
        shouldAutoLink: isAllowedWebUrl,
      }),
      MarkdownHighlight,
      TableKit.configure({
        table: { resizable: false },
        tableCell: {},
        tableHeader: {},
        tableRow: {},
      }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({ indentation: { size: 2, style: 'space' } }),
    ],
    [placeholder],
  )
  const editor = useEditor({
    content: value,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
        class: 'markdown-wysiwyg-content',
      },
    },
    extensions,
    immediatelyRender: true,
    onCreate: ({ editor: currentEditor }) => {
      const markdown = currentEditor.getMarkdown()
      lastEmittedMarkdownRef.current = markdown
      if (markdown !== value) onChangeRef.current(markdown)
      onReadyRef.current?.()
    },
    onUpdate: ({ editor: currentEditor }) => {
      const markdown = currentEditor.getMarkdown()
      lastEmittedMarkdownRef.current = markdown
      onChangeRef.current(markdown)
    },
    shouldRerenderOnTransaction: false,
  })
  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      blockquote: currentEditor.isActive('blockquote'),
      bold: currentEditor.isActive('bold'),
      bulletList: currentEditor.isActive('bulletList'),
      canRedo: currentEditor.can().chain().redo().run(),
      canUndo: currentEditor.can().chain().undo().run(),
      code: currentEditor.isActive('code'),
      codeBlock: currentEditor.isActive('codeBlock'),
      heading: ([1, 2, 3, 4, 5, 6] as HeadingLevel[]).find((level) =>
        currentEditor.isActive('heading', { level }),
      ),
      highlight: currentEditor.isActive('highlight'),
      italic: currentEditor.isActive('italic'),
      link: currentEditor.isActive('link'),
      linkHref: String(currentEditor.getAttributes('link').href ?? ''),
      orderedList: currentEditor.isActive('orderedList'),
      strike: currentEditor.isActive('strike'),
      table: currentEditor.isActive('table'),
    }),
  })

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    if (!initialValueHandledRef.current) {
      initialValueHandledRef.current = true
      return
    }
    if (value === lastEmittedMarkdownRef.current || value === editor.getMarkdown()) return
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
    const markdown = editor.getMarkdown()
    lastEmittedMarkdownRef.current = markdown
    if (markdown !== value) onChangeRef.current(markdown)
  }, [editor, value])

  function setHeading(value: 'paragraph' | HeadingLevel) {
    if (value === 'paragraph') {
      editor.chain().focus().setParagraph().run()
      return
    }
    editor.chain().focus().setHeading({ level: value }).run()
  }

  function openLinkEditor() {
    setLinkHref(toolbarState.linkHref)
    setLinkError('')
    setLinkEditorOpen(true)
    window.requestAnimationFrame(() => linkInputRef.current?.focus())
  }

  function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedHref = normalizeWebUrl(linkHref.trim())
    if (!normalizedHref) {
      setLinkError('请输入有效的 HTTP 或 HTTPS 地址')
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: normalizedHref }).run()
    setLinkEditorOpen(false)
    setLinkError('')
  }

  function removeLink() {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setLinkEditorOpen(false)
    setLinkError('')
  }

  const currentBlockLabel = toolbarState.heading
    ? headingOptions.find((option) => option.value === toolbarState.heading)?.label ?? '标题'
    : toolbarState.codeBlock
      ? '代码块'
      : '正文'

  return (
    <div className="markdown-wysiwyg-editor">
      <div className="markdown-wysiwyg-toolbar" role="toolbar" aria-label={`${ariaLabel}格式工具`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="markdown-wysiwyg-block-trigger"
              aria-label="选择文本样式"
            >
              <span>{currentBlockLabel}</span>
              <CaretDown size={13} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="markdown-wysiwyg-heading-menu">
            {headingOptions.map((option) => (
              <DropdownMenuItem key={option.value} onSelect={() => setHeading(option.value)}>
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarSeparator />
        <ToolbarButton
          label="粗体"
          active={toolbarState.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <TextB size={17} weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="斜体"
          active={toolbarState.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <TextItalic size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="删除线"
          active={toolbarState.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <TextStrikethrough size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="高亮"
          active={toolbarState.highlight}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="链接"
          active={toolbarState.link}
          onClick={openLinkEditor}
        >
          <LinkSimple size={17} />
        </ToolbarButton>

        <ToolbarSeparator />
        <ToolbarButton
          label="无序列表"
          active={toolbarState.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListBullets size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="有序列表"
          active={toolbarState.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListNumbers size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="引用"
          active={toolbarState.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quotes size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="行内代码"
          active={toolbarState.code}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="代码块"
          active={toolbarState.codeBlock}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <CodeBlock size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="分隔线"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus size={17} />
        </ToolbarButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn('markdown-wysiwyg-tool', toolbarState.table && 'is-active')}
              aria-label="表格"
              aria-pressed={toolbarState.table}
              data-tooltip="表格"
            >
              <Table size={17} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {!toolbarState.table ? (
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().insertTable({ cols: 3, rows: 3, withHeaderRow: true }).run()}
              >
                <Table /> 插入 3 x 3 表格
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onSelect={() => editor.chain().focus().addRowAfter().run()}>
                  <RowsPlusBottom /> 在下方添加行
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => editor.chain().focus().addColumnAfter().run()}>
                  <ColumnsPlusRight /> 在右侧添加列
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => editor.chain().focus().deleteRow().run()}>
                  <Trash /> 删除当前行
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => editor.chain().focus().deleteColumn().run()}>
                  <Trash /> 删除当前列
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => editor.chain().focus().deleteTable().run()}>
                  <Trash /> 删除表格
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="markdown-wysiwyg-toolbar-spacer" />
        <span className="markdown-wysiwyg-history-tools">
          <ToolbarButton
            label="撤销"
            disabled={!toolbarState.canUndo}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <ArrowCounterClockwise size={17} />
          </ToolbarButton>
          <ToolbarButton
            label="重做"
            disabled={!toolbarState.canRedo}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <ArrowClockwise size={17} />
          </ToolbarButton>
        </span>

        {linkEditorOpen ? (
          <form className="markdown-wysiwyg-link-popover" onSubmit={submitLink}>
            <label htmlFor="markdown-wysiwyg-link-input">链接地址</label>
            <div className="markdown-wysiwyg-link-row">
              <input
                id="markdown-wysiwyg-link-input"
                ref={linkInputRef}
                value={linkHref}
                aria-invalid={Boolean(linkError)}
                onChange={(event) => {
                  setLinkHref(event.target.value)
                  setLinkError('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setLinkEditorOpen(false)
                }}
                placeholder="https://example.com"
              />
              {toolbarState.link ? (
                <button type="button" className="markdown-wysiwyg-link-remove" onClick={removeLink}>
                  移除
                </button>
              ) : null}
              <button type="submit" className="markdown-wysiwyg-link-apply">
                应用
              </button>
            </div>
            {linkError ? <p>{linkError}</p> : null}
          </form>
        ) : null}
      </div>

      <EditorContent editor={editor} className="markdown-wysiwyg-canvas" />
    </div>
  )
}
