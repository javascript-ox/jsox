package dev.jsox.intellij

import com.intellij.openapi.fileTypes.LanguageFileType
import javax.swing.Icon

class JsoxFileType private constructor() : LanguageFileType(JsoxLanguage) {
  override fun getName(): String = "JSOX"
  override fun getDescription(): String = "JSOX file"
  override fun getDefaultExtension(): String = "jsox"
  override fun getIcon(): Icon = JsoxIcons.FILE

  companion object {
    @JvmField
    val INSTANCE = JsoxFileType()
  }
}
