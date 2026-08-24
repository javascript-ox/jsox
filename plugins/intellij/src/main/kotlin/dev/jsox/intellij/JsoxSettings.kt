package dev.jsox.intellij

import com.intellij.openapi.components.BaseState
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.SimplePersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.components.service

class JsoxState : BaseState() {
  var nodePath by string()
  var serverPath by string()
}

@Service(Service.Level.APP)
@State(name = "JsoxSettings", storages = [Storage("jsox.xml")])
class JsoxSettings : SimplePersistentStateComponent<JsoxState>(JsoxState()) {
  companion object {
    fun getInstance(): JsoxSettings = service()
  }
}
