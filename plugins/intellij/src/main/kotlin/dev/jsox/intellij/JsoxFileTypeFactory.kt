package dev.jsox.intellij

import com.intellij.lang.javascript.JavaScriptFileType
import com.intellij.openapi.fileTypes.FileTypeConsumer
import com.intellij.openapi.fileTypes.FileTypeFactory

class JsoxFileTypeFactory : FileTypeFactory() {
  override fun createFileTypes(consumer: FileTypeConsumer) {
    consumer.consume(JavaScriptFileType.INSTANCE, "jsox")
  }
}
