package dev.jsox.intellij

import com.intellij.lang.annotation.AnnotationHolder
import com.intellij.lang.annotation.Annotator
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.lang.javascript.psi.JSLiteralExpression
import com.intellij.openapi.editor.DefaultLanguageHighlighterColors
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiComment
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiRecursiveElementWalkingVisitor

class JsoxAnnotator : Annotator {
  override fun annotate(element: PsiElement, holder: AnnotationHolder) {
    if (element !is PsiFile) return
    if (element.virtualFile?.extension != "jsox") return

    val skip = skipRanges(element)
    highlight(element, holder, TAG, DefaultLanguageHighlighterColors.KEYWORD, skip)
    highlight(element, holder, THIS_SHORTHAND, DefaultLanguageHighlighterColors.INSTANCE_FIELD, skip)
  }

  private fun skipRanges(file: PsiFile): List<TextRange> {
    val ranges = ArrayList<TextRange>()
    file.accept(object : PsiRecursiveElementWalkingVisitor() {
      override fun visitComment(comment: PsiComment) {
        ranges.add(comment.textRange)
      }

      override fun visitElement(el: PsiElement) {
        if (el is JSLiteralExpression) {
          ranges.add(el.textRange)
          return
        }
        super.visitElement(el)
      }
    })
    return ranges
  }

  private fun highlight(
    file: PsiFile,
    holder: AnnotationHolder,
    pattern: Regex,
    attributes: com.intellij.openapi.editor.colors.TextAttributesKey,
    skip: List<TextRange>,
  ) {
    val base = file.textRange.startOffset
    for (match in pattern.findAll(file.text)) {
      val start = base + match.range.first
      val end = base + match.range.last + 1
      val range = TextRange(start, end)
      if (skip.any { it.intersects(range) }) continue
      holder.newSilentAnnotation(HighlightSeverity.INFORMATION)
        .range(range)
        .textAttributes(attributes)
        .create()
    }
  }

  companion object {
    private val TAG = Regex("<[A-Za-z][\\w-]*>")
    private val THIS_SHORTHAND = Regex("(?<=^|[\\{\\;\\n])\\s*(\\.[A-Za-z_\$][\\w\$]*)")
  }
}
