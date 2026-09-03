package dev.jsox.intellij

import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.fileTypes.SyntaxHighlighter
import com.intellij.openapi.options.colors.AttributesDescriptor
import com.intellij.openapi.options.colors.ColorDescriptor
import com.intellij.openapi.options.colors.ColorSettingsPage
import javax.swing.Icon

class JsoxColorSettingsPage : ColorSettingsPage {
  override fun getIcon(): Icon = JsoxIcons.FILE

  override fun getHighlighter(): SyntaxHighlighter = JsoxSyntaxHighlighter()

  override fun getDemoText(): String = """
    export function view() {
      const title = <<jsoxNamespace>react</jsoxNamespace>:h1> {
        .className = "title"
      }
      return title
    }
  """.trimIndent()

  override fun getAttributeDescriptors(): Array<AttributesDescriptor> = DESCRIPTORS

  override fun getColorDescriptors(): Array<ColorDescriptor> = ColorDescriptor.EMPTY_ARRAY

  override fun getDisplayName(): String = "JSOX"

  override fun getAdditionalHighlightingTagToDescriptorMap(): Map<String, TextAttributesKey> =
    mapOf("jsoxNamespace" to JsoxSyntaxHighlighter.NAMESPACE)

  companion object {
    private val DESCRIPTORS = arrayOf(
      AttributesDescriptor("Scoped tag//Namespace", JsoxSyntaxHighlighter.NAMESPACE),
    )
  }
}
