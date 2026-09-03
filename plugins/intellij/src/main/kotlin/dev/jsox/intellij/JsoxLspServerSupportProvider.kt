package dev.jsox.intellij

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.editor.DefaultLanguageHighlighterColors
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.LspServer
import com.intellij.platform.lsp.api.LspServerSupportProvider
import com.intellij.platform.lsp.api.ProjectWideLspServerDescriptor
import com.intellij.platform.lsp.api.customization.LspSemanticTokensSupport
import com.intellij.platform.lsp.api.lsWidget.LspServerWidgetItem
import com.intellij.psi.PsiFile
import com.intellij.util.EnvironmentUtil
import java.nio.charset.StandardCharsets

class JsoxLspServerSupportProvider : LspServerSupportProvider {
  override fun fileOpened(
    project: Project,
    file: VirtualFile,
    serverStarter: LspServerSupportProvider.LspServerStarter,
  ) {
    if (!file.extension.equals("jsox", ignoreCase = true)) return
    try {
      serverStarter.ensureServerStarted(JsoxLspServerDescriptor(project))
    } catch (e: Exception) {
      thisLogger().warn("JSOX language server not started: ${e.message}", e)
      NotificationGroupManager.getInstance()
        .getNotificationGroup("JSOX")
        .createNotification(
          "JSOX language server failed to start",
          e.message ?: e.toString(),
          NotificationType.ERROR,
        )
        .notify(project)
    }
  }

  override fun createLspServerWidgetItem(lspServer: LspServer, currentFile: VirtualFile?): LspServerWidgetItem =
    LspServerWidgetItem(lspServer, currentFile, JsoxIcons.FILE, JsoxConfigurable::class.java)
}

private class JsoxLspServerDescriptor(project: Project) :
  ProjectWideLspServerDescriptor(project, "JSOX") {

  override val lspSemanticTokensSupport = JsoxSemanticTokensSupport()

  override fun isSupportedFile(file: VirtualFile): Boolean =
    file.extension.equals("jsox", ignoreCase = true)

  override fun getLanguageId(file: VirtualFile): String = "jsox"

  override fun createCommandLine(): GeneralCommandLine {
    val node = JsoxPaths.node()
    val script = JsoxPaths.serverScript()
    thisLogger().info("JSOX LSP: $node $script")
    return GeneralCommandLine(node, script.toAbsolutePath().toString())
      .withWorkDirectory(script.parent.toFile())
      .withCharset(StandardCharsets.UTF_8)
      .withEnvironment(EnvironmentUtil.getEnvironmentMap())
  }
}

private class JsoxSemanticTokensSupport : LspSemanticTokensSupport() {
  override fun shouldAskServerForSemanticTokens(psiFile: PsiFile): Boolean = true

  override fun getTextAttributesKey(
    tokenType: String,
    modifiers: List<String>,
  ): TextAttributesKey? =
    when (tokenType) {
      "function" -> JS_FUNCTION
      "method" -> JS_METHOD
      "namespace" -> JsoxSyntaxHighlighter.NAMESPACE
      else -> super.getTextAttributesKey(tokenType, modifiers)
    }

  companion object {
    private val JS_FUNCTION = TextAttributesKey.createTextAttributesKey(
      "JS.GLOBAL_FUNCTION",
      DefaultLanguageHighlighterColors.FUNCTION_DECLARATION,
    )
    private val JS_METHOD = TextAttributesKey.createTextAttributesKey(
      "JS.INSTANCE_MEMBER_FUNCTION",
      DefaultLanguageHighlighterColors.INSTANCE_METHOD,
    )
  }
}
