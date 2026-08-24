import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.intellij.platform.gradle.tasks.PrepareSandboxTask

plugins {
  id("java")
  id("org.jetbrains.kotlin.jvm") version "2.1.10"
  id("org.jetbrains.intellij.platform") version "2.5.0"
}

group = providers.gradleProperty("pluginGroup").get()
version = providers.gradleProperty("pluginVersion").get()

kotlin {
  jvmToolchain(17)
}

val repoRoot = layout.projectDirectory.dir("../..")
val lspDist = layout.buildDirectory.dir("lsp")

repositories {
  mavenCentral()
  intellijPlatform {
    defaultRepositories()
  }
}

dependencies {
  intellijPlatform {
    intellijIdeaUltimate(providers.gradleProperty("platformVersion"))
    testFramework(TestFrameworkType.Platform)
  }
}

intellijPlatform {
  pluginConfiguration {
    id = "dev.jsox"
    name = providers.gradleProperty("pluginName")
    version = providers.gradleProperty("pluginVersion")
    ideaVersion {
      sinceBuild = providers.gradleProperty("pluginSinceBuild")
      untilBuild = provider { null }
    }
    description = """
      JSOX (JavaScript Object eXtensions) for IntelliJ IDEA and WebStorm.
      Own <code>.jsox</code> file type plus the JSOX language server for hover,
      completion, and go to definition. Does not parse files as JavaScript/JSX.
    """.trimIndent()
    vendor {
      name = "JSOX"
    }
  }
}

val bundleLsp by tasks.registering(Exec::class) {
  val outDir = lspDist.get().asFile
  outputs.dir(outDir)
  workingDir = repoRoot.asFile
  commandLine(
    "npx",
    "--yes",
    "esbuild",
    "packages/lsp/src/cli.js",
    "--bundle",
    "--platform=node",
    "--format=cjs",
    "--outfile=${outDir.resolve("jsox-lsp.cjs")}",
    "--external:typescript",
  )
  doLast {
    val tsSrc = repoRoot.asFile.resolve("node_modules/typescript")
    val tsDest = outDir.resolve("node_modules/typescript")
    tsDest.parentFile.mkdirs()
    copy {
      from(tsSrc)
      into(tsDest)
      exclude("*.tsbuildinfo")
    }
  }
}

tasks.named<PrepareSandboxTask>("prepareSandbox") {
  dependsOn(bundleLsp)
  from(lspDist) {
    into("${providers.gradleProperty("pluginName").get()}/lsp")
  }
  from(lspDist) {
    into("jsox-intellij/lsp")
  }
}

tasks.buildPlugin {
  dependsOn(bundleLsp)
  duplicatesStrategy = DuplicatesStrategy.INCLUDE
  notCompatibleWithConfigurationCache("IntelliJ Platform")
}
