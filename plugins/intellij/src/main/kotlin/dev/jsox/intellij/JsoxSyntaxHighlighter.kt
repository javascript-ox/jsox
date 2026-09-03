package dev.jsox.intellij

import com.intellij.lexer.Lexer
import com.intellij.openapi.editor.DefaultLanguageHighlighterColors
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.fileTypes.SyntaxHighlighterBase
import com.intellij.psi.tree.IElementType

class JsoxSyntaxHighlighter : SyntaxHighlighterBase() {
  override fun getHighlightingLexer(): Lexer = JsoxLexer()

  override fun getTokenHighlights(tokenType: IElementType): Array<TextAttributesKey> =
    when (tokenType) {
      JsoxTokenTypes.KEYWORD -> KEYS_KEYWORD
      JsoxTokenTypes.STRING -> KEYS_STRING
      JsoxTokenTypes.COMMENT -> KEYS_COMMENT
      JsoxTokenTypes.NUMBER -> KEYS_NUMBER
      JsoxTokenTypes.TAG -> KEYS_TAG
      JsoxTokenTypes.SELECTOR_BRACKET -> KEYS_SELECTOR_BRACKET
      JsoxTokenTypes.PROPERTY -> KEYS_PROPERTY
      JsoxTokenTypes.IDENT -> KEYS_IDENT
      else -> TextAttributesKey.EMPTY_ARRAY
    }

  companion object {
    val NAMESPACE = TextAttributesKey.createTextAttributesKey(
      "JSOX_NAMESPACE",
      DefaultLanguageHighlighterColors.CLASS_NAME,
    )
    private val KEYS_KEYWORD = arrayOf(DefaultLanguageHighlighterColors.KEYWORD)
    private val KEYS_STRING = arrayOf(DefaultLanguageHighlighterColors.STRING)
    private val KEYS_COMMENT = arrayOf(DefaultLanguageHighlighterColors.LINE_COMMENT)
    private val KEYS_NUMBER = arrayOf(DefaultLanguageHighlighterColors.NUMBER)
    private val KEYS_TAG = arrayOf(DefaultLanguageHighlighterColors.METADATA)
    private val KEYS_SELECTOR_BRACKET = arrayOf(
      TextAttributesKey.createTextAttributesKey(
        "JSOX_SELECTOR_BRACKETS",
        DefaultLanguageHighlighterColors.STRING,
      ),
    )
    private val KEYS_PROPERTY = arrayOf(DefaultLanguageHighlighterColors.INSTANCE_FIELD)
    private val KEYS_IDENT = arrayOf(DefaultLanguageHighlighterColors.IDENTIFIER)
  }
}
