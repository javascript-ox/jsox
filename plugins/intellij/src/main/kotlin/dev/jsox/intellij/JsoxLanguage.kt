package dev.jsox.intellij

import com.intellij.lang.Language

object JsoxLanguage : Language("JSOX") {
  private fun readResolve(): Any = JsoxLanguage
}
