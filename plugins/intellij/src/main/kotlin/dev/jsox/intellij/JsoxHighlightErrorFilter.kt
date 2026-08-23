package dev.jsox.intellij

import com.intellij.codeInsight.highlighting.HighlightErrorFilter
import com.intellij.psi.PsiErrorElement

class JsoxHighlightErrorFilter : HighlightErrorFilter() {
  override fun shouldHighlightErrorElement(element: PsiErrorElement): Boolean {
    if (element.containingFile?.virtualFile?.extension != "jsox") return true
    val text = element.text.trim()
    if (text.startsWith("<") || text.startsWith(".")) return false
    val description = element.errorDescription
    if ('<' in description) return false
    return true
  }
}
