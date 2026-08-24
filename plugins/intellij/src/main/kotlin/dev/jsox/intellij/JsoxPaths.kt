package dev.jsox.intellij

import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.extensions.PluginId
import com.intellij.util.EnvironmentUtil
import java.io.File
import java.nio.file.Files
import java.nio.file.Path

object JsoxPaths {
  fun node(): String {
    JsoxSettings.getInstance().state.nodePath
      ?.trim()
      ?.takeIf { it.isNotEmpty() && File(it).canExecute() }
      ?.let { return it }

    val path = EnvironmentUtil.getValue("PATH") ?: System.getenv("PATH") ?: ""
    for (dir in path.split(File.pathSeparator)) {
      val candidate = File(dir, "node")
      if (candidate.canExecute()) return candidate.absolutePath
    }

    val nvm = File(System.getProperty("user.home"), ".nvm/versions/node")
    nvm.listFiles()?.sortedByDescending { it.name }?.forEach { version ->
      val candidate = File(version, "bin/node")
      if (candidate.canExecute()) return candidate.absolutePath
    }

    val brew = listOf(
      "/opt/homebrew/bin/node",
      "/usr/local/bin/node",
    )
    for (p in brew) {
      if (File(p).canExecute()) return p
    }

    return "node"
  }

  fun serverScript(): Path {
    JsoxSettings.getInstance().state.serverPath
      ?.trim()
      ?.takeIf { it.isNotEmpty() }
      ?.let { return Path.of(it) }

    val plugin = PluginManagerCore.getPlugin(PluginId.getId("dev.jsox"))
    if (plugin != null) {
      val bundled = plugin.pluginPath.resolve("lsp/jsox-lsp.cjs")
      if (Files.isRegularFile(bundled)) return bundled
    }

    val fromRepo = Path.of(System.getProperty("user.dir"), "packages/lsp/src/cli.js")
    if (Files.isRegularFile(fromRepo)) return fromRepo

    error("JSOX language server script not found. Set Settings → JSOX → Server script.")
  }
}
