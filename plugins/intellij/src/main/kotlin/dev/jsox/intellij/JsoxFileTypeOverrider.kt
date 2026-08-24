package dev.jsox.intellij

import com.intellij.openapi.fileTypes.FileType
import com.intellij.openapi.fileTypes.impl.FileTypeOverrider
import com.intellij.openapi.vfs.VirtualFile

class JsoxFileTypeOverrider : FileTypeOverrider {
  override fun getOverriddenFileType(file: VirtualFile): FileType? =
    if (file.extension.equals("jsox", ignoreCase = true)) JsoxFileType.INSTANCE else null
}
