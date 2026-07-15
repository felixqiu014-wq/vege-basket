import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CaretDown,
  Check,
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
  TextT,
  Trash,
  X,
} from '@phosphor-icons/react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Highlight } from '@tiptap/extension-highlight'
import { Link } from '@tiptap/extension-link'
import { Markdown } from '@tiptap/markdown'
import { Placeholder } from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { common, createLowlight } from 'lowlight'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type MarkdownWysiwygEditorProps = {
  ariaLabel: string
  onChange: (markdown: string) => void
  onReady?: () => void
  placeholder?: string
  value: string
}

type ToolbarButtonProps = Omit<ComponentPropsWithoutRef<'button'>, 'children'> & {
  active?: boolean
  children: ReactNode
  label: string
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

const syntaxHighlighter = createLowlight(common)
syntaxHighlighter.highlightAuto = (source) => syntaxHighlighter.highlight('plaintext', source)

type SyntaxLanguageOption = {
  label: string
  value: string
}

const syntaxLanguageLabels: Record<string, string> = {
  arduino: 'Arduino',
  bash: 'Bash',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  css: 'CSS',
  diff: 'Diff',
  go: 'Go',
  graphql: 'GraphQL',
  ini: 'INI',
  java: 'Java',
  javascript: 'JavaScript',
  json: 'JSON',
  kotlin: 'Kotlin',
  less: 'Less',
  lua: 'Lua',
  makefile: 'Makefile',
  markdown: 'Markdown',
  objectivec: 'Objective-C',
  perl: 'Perl',
  php: 'PHP',
  'php-template': 'PHP Template',
  python: 'Python',
  'python-repl': 'Python REPL',
  r: 'R',
  ruby: 'Ruby',
  rust: 'Rust',
  scss: 'SCSS',
  shell: 'Shell',
  sql: 'SQL',
  swift: 'Swift',
  typescript: 'TypeScript',
  vbnet: 'VB.NET',
  wasm: 'WebAssembly',
  xml: 'HTML / XML',
  yaml: 'YAML',
}

const preferredSyntaxLanguages = [
  'javascript',
  'typescript',
  'json',
  'bash',
  'shell',
  'yaml',
  'xml',
  'css',
  'markdown',
  'sql',
  'go',
  'python',
]

const registeredSyntaxLanguages = syntaxHighlighter
  .listLanguages()
  .filter((language) => language !== 'plaintext')
const otherSyntaxLanguages = registeredSyntaxLanguages
  .filter((language) => !preferredSyntaxLanguages.includes(language))
  .sort((left, right) => left.localeCompare(right))
const preferredSyntaxLanguageOptions: SyntaxLanguageOption[] = [
  { label: '纯文本', value: '' },
  ...preferredSyntaxLanguages.map((value) => ({
    label: syntaxLanguageLabels[value] ?? value,
    value,
  })),
]
const otherSyntaxLanguageOptions: SyntaxLanguageOption[] = otherSyntaxLanguages.map((value) => ({
  label: syntaxLanguageLabels[value] ?? value,
  value,
}))
const syntaxLanguageAliases: Record<string, string> = {
  'c#': 'csharp',
  'c++': 'cpp',
  cs: 'csharp',
  html: 'xml',
  js: 'javascript',
  jsx: 'javascript',
  md: 'markdown',
  objc: 'objectivec',
  plaintext: '',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'bash',
  text: '',
  ts: 'typescript',
  tsx: 'typescript',
  txt: '',
  yml: 'yaml',
  zsh: 'shell',
}

function normalizeSyntaxLanguage(value: string) {
  const normalized = value.trim().toLowerCase()
  return syntaxLanguageAliases[normalized] ?? normalized
}

function getSyntaxLanguageLabel(value: string) {
  const normalized = normalizeSyntaxLanguage(value)
  if (!normalized) return '纯文本'
  return syntaxLanguageLabels[normalized] ?? normalized
}

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

const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ active, children, className, label, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn('markdown-wysiwyg-tool', active === true && 'is-active', className)}
      aria-label={label}
      aria-pressed={active}
      data-tooltip={label}
      {...props}
    >
      {children}
    </button>
  ),
)

ToolbarButton.displayName = 'ToolbarButton'

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
  const linkSelectionPreparedRef = useRef(false)
  const linkSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const restoreEditorFocusRef = useRef(false)
  const linkInputId = useId()
  const linkErrorId = `${linkInputId}-error`
  const [linkEditorOpen, setLinkEditorOpen] = useState(false)
  const [editingExistingLink, setEditingExistingLink] = useState(false)
  const [linkHref, setLinkHref] = useState('')
  const [linkError, setLinkError] = useState('')
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
        link: false,
      }),
      CodeBlockLowlight.configure({
        defaultLanguage: 'plaintext',
        languageClassPrefix: 'language-',
        lowlight: syntaxHighlighter,
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
      codeBlockLanguage: String(currentEditor.getAttributes('codeBlock').language ?? ''),
      heading: ([1, 2, 3, 4, 5, 6] as HeadingLevel[]).find((level) =>
        currentEditor.isActive('heading', { level }),
      ),
      highlight: currentEditor.isActive('highlight'),
      italic: currentEditor.isActive('italic'),
      link: currentEditor.isActive('link'),
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

  function setCodeBlockLanguage(language: string) {
    if (editor.isActive('codeBlock')) {
      editor.chain().focus().updateAttributes('codeBlock', { language: language || null }).run()
      return
    }

    editor.chain().focus().setCodeBlock({ language }).run()
  }

  function prepareLinkEditor() {
    const { from, to } = editor.state.selection
    linkSelectionPreparedRef.current = true
    linkSelectionRef.current = { from, to }
    setEditingExistingLink(editor.isActive('link'))
    setLinkHref(String(editor.getAttributes('link').href ?? ''))
  }

  function handleLinkEditorOpenChange(nextOpen: boolean) {
    if (nextOpen && !linkSelectionPreparedRef.current) prepareLinkEditor()
    if (!nextOpen) linkSelectionPreparedRef.current = false

    setLinkError('')
    setLinkEditorOpen(nextOpen)
  }

  function restoreLinkSelection() {
    const selection = linkSelectionRef.current
    const chain = editor.chain().focus()
    return selection ? chain.setTextSelection(selection) : chain
  }

  function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedHref = normalizeWebUrl(linkHref.trim())
    if (!normalizedHref) {
      setLinkError('请输入有效的 HTTP 或 HTTPS 地址')
      return
    }

    restoreLinkSelection().extendMarkRange('link').setLink({ href: normalizedHref }).run()
    restoreEditorFocusRef.current = true
    handleLinkEditorOpenChange(false)
  }

  function removeLink() {
    restoreLinkSelection().extendMarkRange('link').unsetLink().run()
    restoreEditorFocusRef.current = true
    handleLinkEditorOpenChange(false)
  }

  const currentBlockLabel = toolbarState.heading
    ? headingOptions.find((option) => option.value === toolbarState.heading)?.label ?? '标题'
    : toolbarState.codeBlock
      ? '代码块'
      : '正文'
  const currentCodeLanguage = normalizeSyntaxLanguage(toolbarState.codeBlockLanguage)
  const currentCodeLanguageKnown =
    currentCodeLanguage === '' || registeredSyntaxLanguages.includes(currentCodeLanguage)
  const currentCodeLanguageLabel = getSyntaxLanguageLabel(toolbarState.codeBlockLanguage)

  function renderSyntaxLanguageOption(option: SyntaxLanguageOption) {
    const selected = toolbarState.codeBlock && currentCodeLanguage === option.value

    return (
      <DropdownMenuItem
        key={option.value || 'plaintext'}
        className="markdown-wysiwyg-code-language-option"
        data-selected={selected}
        onSelect={() => setCodeBlockLanguage(option.value)}
      >
        <Check className="markdown-wysiwyg-code-language-check" aria-hidden="true" />
        <span>{option.label}</span>
        <code>{option.value || 'plain'}</code>
      </DropdownMenuItem>
    )
  }

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
        <Popover open={linkEditorOpen} onOpenChange={handleLinkEditorOpenChange}>
          <PopoverTrigger asChild>
            <ToolbarButton
              label="链接"
              active={toolbarState.link}
              onPointerDown={() => {
                if (!linkEditorOpen) prepareLinkEditor()
              }}
            >
              <LinkSimple size={17} />
            </ToolbarButton>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="bottom"
            className="markdown-wysiwyg-link-popover"
            aria-label="编辑链接"
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              linkInputRef.current?.focus()
              linkInputRef.current?.select()
            }}
            onCloseAutoFocus={(event) => {
              if (!restoreEditorFocusRef.current) return
              event.preventDefault()
              restoreEditorFocusRef.current = false
              window.requestAnimationFrame(() => editor.commands.focus())
            }}
          >
            <form className="markdown-wysiwyg-link-form" onSubmit={submitLink}>
              <div className="markdown-wysiwyg-link-header">
                <label htmlFor={linkInputId}>链接地址</label>
                <PopoverClose asChild>
                  <button
                    type="button"
                    className="markdown-wysiwyg-link-close"
                    aria-label="关闭链接编辑"
                  >
                    <X size={15} />
                  </button>
                </PopoverClose>
              </div>
              <div className="markdown-wysiwyg-link-row">
                <input
                  id={linkInputId}
                  ref={linkInputRef}
                  value={linkHref}
                  aria-describedby={linkError ? linkErrorId : undefined}
                  aria-invalid={Boolean(linkError)}
                  onChange={(event) => {
                    setLinkHref(event.target.value)
                    setLinkError('')
                  }}
                  placeholder="https://example.com"
                />
                {editingExistingLink ? (
                  <button type="button" className="markdown-wysiwyg-link-remove" onClick={removeLink}>
                    移除
                  </button>
                ) : null}
                <button type="submit" className="markdown-wysiwyg-link-apply">
                  应用
                </button>
              </div>
              {linkError ? <p id={linkErrorId}>{linkError}</p> : null}
            </form>
          </PopoverContent>
        </Popover>

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'markdown-wysiwyg-tool markdown-wysiwyg-code-trigger',
                toolbarState.codeBlock && 'is-active',
              )}
              aria-label={
                toolbarState.codeBlock
                  ? `代码块，当前语言：${currentCodeLanguageLabel}`
                  : '插入代码块并选择语言'
              }
              aria-pressed={toolbarState.codeBlock}
              data-tooltip={toolbarState.codeBlock ? currentCodeLanguageLabel : '代码块'}
            >
              <CodeBlock size={17} />
              <CaretDown className="markdown-wysiwyg-code-trigger-caret" size={10} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="markdown-wysiwyg-code-menu">
            {toolbarState.codeBlock && !currentCodeLanguageKnown ? (
              <>
                <DropdownMenuItem disabled>
                  未知语言：{toolbarState.codeBlockLanguage}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            {preferredSyntaxLanguageOptions.map(renderSyntaxLanguageOption)}
            <DropdownMenuSeparator />
            {otherSyntaxLanguageOptions.map(renderSyntaxLanguageOption)}
            {toolbarState.codeBlock ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => editor.chain().focus().toggleCodeBlock().run()}>
                  <TextT /> 转为正文
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
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

      </div>

      <EditorContent editor={editor} className="markdown-wysiwyg-canvas" />
    </div>
  )
}
