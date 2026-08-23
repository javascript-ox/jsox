import org.jetbrains.intellij.platform.gradle.TestFrameworkType

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

repositories {
  mavenCentral()
  intellijPlatform {
    defaultRepositories()
  }
}

dependencies {
  intellijPlatform {
    intellijIdeaUltimate(providers.gradleProperty("platformVersion"))
    bundledPlugin("JavaScript")
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
      Treats <code>.jsox</code> as JavaScript so identifiers, completions, and
      inspections work, and highlights <code>&lt;tag&gt;</code> plus leading
      <code>.prop</code> shorthand on top.
    """.trimIndent()
    vendor {
      name = "JSOX"
    }
  }
}

tasks.buildPlugin {
  notCompatibleWithConfigurationCache("IntelliJ Platform")
}
