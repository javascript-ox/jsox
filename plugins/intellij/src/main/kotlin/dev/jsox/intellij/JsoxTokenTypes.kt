package dev.jsox.intellij

import com.intellij.psi.tree.IElementType

object JsoxTokenTypes {
  @JvmField val KEYWORD = IElementType("JSOX_KEYWORD", JsoxLanguage)
  @JvmField val IDENT = IElementType("JSOX_IDENT", JsoxLanguage)
  @JvmField val NUMBER = IElementType("JSOX_NUMBER", JsoxLanguage)
  @JvmField val STRING = IElementType("JSOX_STRING", JsoxLanguage)
  @JvmField val COMMENT = IElementType("JSOX_COMMENT", JsoxLanguage)
  @JvmField val TAG = IElementType("JSOX_TAG", JsoxLanguage)
  @JvmField val PROPERTY = IElementType("JSOX_PROPERTY", JsoxLanguage)
  @JvmField val PUNCT = IElementType("JSOX_PUNCT", JsoxLanguage)
  @JvmField val OTHER = IElementType("JSOX_OTHER", JsoxLanguage)
}
