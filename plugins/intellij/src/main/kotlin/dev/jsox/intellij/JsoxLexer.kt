package dev.jsox.intellij

import com.intellij.lexer.LexerBase
import com.intellij.psi.tree.IElementType

private val KEYWORDS = setOf(
  "break", "case", "catch", "class", "const", "continue", "debugger", "default",
  "delete", "do", "else", "export", "extends", "false", "finally", "for",
  "function", "if", "import", "in", "instanceof", "let", "new", "null",
  "return", "super", "switch", "this", "throw", "true", "try", "typeof",
  "var", "void", "while", "with", "yield", "async", "await", "from", "of",
)

class JsoxLexer : LexerBase() {
  private var buffer: CharSequence = ""
  private var start = 0
  private var end = 0
  private var tokenStart = 0
  private var tokenEnd = 0
  private var type: IElementType? = null
  private var lastNonWs: Char? = null

  override fun start(buffer: CharSequence, startOffset: Int, endOffset: Int, initialState: Int) {
    this.buffer = buffer
    start = startOffset
    end = endOffset
    tokenStart = startOffset
    tokenEnd = startOffset
    lastNonWs = null
    advance()
  }

  override fun getState(): Int = 0
  override fun getTokenType(): IElementType? = type
  override fun getTokenStart(): Int = tokenStart
  override fun getTokenEnd(): Int = tokenEnd
  override fun getBufferSequence(): CharSequence = buffer
  override fun getBufferEnd(): Int = end

  override fun advance() {
    tokenStart = tokenEnd
    if (tokenStart >= end) {
      type = null
      return
    }
    scan()
    if (type != null && tokenEnd <= tokenStart) {
      type = JsoxTokenTypes.OTHER
      tokenEnd = (tokenStart + 1).coerceAtMost(end)
    }
    if (tokenEnd > end) tokenEnd = end
    if (type != null && tokenEnd <= tokenStart) {
      type = null
    }
  }

  private fun scan() {
    val c = buffer[tokenStart]
    when {
      c == '/' && peek(1) == '/' -> {
        var i = tokenStart + 2
        while (i < end && buffer[i] != '\n') i++
        emit(JsoxTokenTypes.COMMENT, i)
      }
      c == '/' && peek(1) == '*' -> {
        var i = tokenStart + 2
        while (i + 1 < end && !(buffer[i] == '*' && buffer[i + 1] == '/')) i++
        emit(JsoxTokenTypes.COMMENT, if (i + 1 < end) i + 2 else end)
      }
      c == '"' || c == '\'' || c == '`' -> emit(JsoxTokenTypes.STRING, skipString(c))
      c == '<' && tokenStart + 1 < end && isIdentStart(buffer[tokenStart + 1]) -> {
        var i = tokenStart + 2
        while (i < end && (isIdentPart(buffer[i]) || buffer[i] == '-')) i++
        if (i < end && buffer[i] == '>') emit(JsoxTokenTypes.TAG, i + 1)
        else emit(JsoxTokenTypes.PUNCT, tokenStart + 1)
      }
      c == '.' && thisShorthand() && tokenStart + 1 < end && isIdentStart(buffer[tokenStart + 1]) -> {
        var i = tokenStart + 2
        while (i < end && isIdentPart(buffer[i])) i++
        emit(JsoxTokenTypes.PROPERTY, i)
      }
      c.isDigit() -> {
        var i = tokenStart + 1
        while (i < end && (buffer[i].isDigit() || buffer[i] == '.')) i++
        emit(JsoxTokenTypes.NUMBER, i)
      }
      isIdentStart(c) -> {
        var i = tokenStart + 1
        while (i < end && isIdentPart(buffer[i])) i++
        val word = buffer.subSequence(tokenStart, i).toString()
        emit(if (word in KEYWORDS) JsoxTokenTypes.KEYWORD else JsoxTokenTypes.IDENT, i)
      }
      c.isWhitespace() -> {
        var i = tokenStart + 1
        while (i < end && buffer[i].isWhitespace()) i++
        emit(JsoxTokenTypes.OTHER, i)
      }
      else -> emit(JsoxTokenTypes.PUNCT, tokenStart + 1)
    }
  }

  private fun emit(t: IElementType, to: Int) {
    type = t
    tokenEnd = to
    if (t != JsoxTokenTypes.OTHER && t != JsoxTokenTypes.COMMENT) {
      var i = to - 1
      while (i >= tokenStart && buffer[i].isWhitespace()) i--
      if (i >= tokenStart) lastNonWs = buffer[i]
    }
  }

  private fun thisShorthand(): Boolean {
    val prev = lastNonWs
    return prev == null || prev == '{' || prev == ';' || prev == '}' || prev == '(' || prev == ','
  }

  private fun peek(n: Int): Char? {
    val i = tokenStart + n
    return if (i < end) buffer[i] else null
  }

  private fun skipString(quote: Char): Int {
    var i = tokenStart + 1
    while (i < end) {
      when (buffer[i]) {
        '\\' -> i += 2
        quote -> return i + 1
        '\n' -> if (quote != '`') return i else i++
        else -> i++
      }
    }
    return end
  }

  private fun isIdentStart(c: Char) = c == '_' || c == '$' || c.isLetter()
  private fun isIdentPart(c: Char) = isIdentStart(c) || c.isDigit()
}
