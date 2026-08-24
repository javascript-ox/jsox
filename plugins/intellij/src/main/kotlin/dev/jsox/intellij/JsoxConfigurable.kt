package dev.jsox.intellij

import com.intellij.openapi.options.BoundConfigurable
import com.intellij.openapi.ui.DialogPanel
import com.intellij.ui.dsl.builder.bindText
import com.intellij.ui.dsl.builder.panel

class JsoxConfigurable : BoundConfigurable("JSOX") {
  private val settings get() = JsoxSettings.getInstance().state

  override fun createPanel(): DialogPanel = panel {
    row("Node binary:") {
      textField()
        .bindText(
          { settings.nodePath ?: "" },
          { settings.nodePath = it.ifBlank { null } },
        )
        .comment("Empty = search PATH and ~/.nvm")
    }
    row("Server script:") {
      textField()
        .bindText(
          { settings.serverPath ?: "" },
          { settings.serverPath = it.ifBlank { null } },
        )
        .comment("Empty = bundled jsox-lsp.cjs")
    }
  }
}
