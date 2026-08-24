package dev.jsox.intellij

import com.intellij.extapi.psi.PsiFileBase
import com.intellij.openapi.fileTypes.FileType
import com.intellij.psi.FileViewProvider

class JsoxFile(viewProvider: FileViewProvider) : PsiFileBase(viewProvider, JsoxLanguage) {
  override fun getFileType(): FileType = JsoxFileType.INSTANCE
}
