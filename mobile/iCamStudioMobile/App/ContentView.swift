import SwiftUI

/// Tela da Fase 1: lista câmeras reais, escolhe resolução/FPS/codec válidos para a lente,
/// inicia a captura e mostra o preview local. Controle remoto e transmissão: Fases 2 e 3.
struct ContentView: View {
    @StateObject private var model = CaptureViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                CameraPreviewView(session: model.session)
                    .aspectRatio(16.0 / 9.0, contentMode: .fit)
                    .background(Color.black)
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                Text(model.statusText)
                    .font(.headline)

                if let error = model.errorText {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }

                Group {
                    optionalPicker("Câmera", selection: $model.selectedCameraId,
                                   options: model.cameras.map { ($0.cameraId, "\($0.displayName) (\($0.position.rawValue))") })
                    optionalPicker("Resolução", selection: $model.selectedResolution,
                                   options: model.resolutionOptions.map { ($0, $0) })
                    picker("FPS", selection: $model.selectedFps,
                           options: model.fpsOptions.map { ($0, "\(Int($0))") })
                    picker("Codec", selection: $model.selectedCodec,
                           options: model.codecOptions.map { ($0, $0.rawValue.uppercased()) })
                }
                .disabled(model.isRunning)

                Divider()

                LabeledContent("FPS codificado", value: String(format: "%.1f", model.encodedFps))
                LabeledContent("Bitrate", value: "\(model.bitrateKbps) kbps")
                LabeledContent("Encoder", value: encoderLabel)

                HStack {
                    Button("Listar câmeras") { Task { await model.refreshCameras() } }
                        .buttonStyle(.bordered)
                        .disabled(model.isRunning)
                    Spacer()
                    if model.isRunning {
                        Button("Parar") { Task { await model.stop() } }
                            .buttonStyle(.borderedProminent)
                            .tint(.red)
                    } else {
                        Button("Iniciar captura") { Task { await model.start() } }
                            .buttonStyle(.borderedProminent)
                            .disabled(model.selectedCameraId == nil)
                    }
                }
            }
            .padding(16)
        }
        .preferredColorScheme(.dark)
        .task { await model.refreshCameras() }
    }

    private var encoderLabel: String {
        switch model.encoderIsHardware {
        case .some(true): return "Hardware"
        case .some(false): return "Software"
        case .none: return "—"
        }
    }

    /// Picker para seleção opcional (ex.: câmera ainda não descoberta). Nomes distintos evitam ambiguidade de overload.
    private func optionalPicker<Value: Hashable>(_ title: String, selection: Binding<Value?>,
                                                 options: [(Value, String)]) -> some View {
        Picker(title, selection: selection) {
            ForEach(options, id: \.0) { value, label in
                Text(label).tag(Optional(value))
            }
        }
    }

    /// Picker para seleção obrigatória.
    private func picker<Value: Hashable>(_ title: String, selection: Binding<Value>,
                                         options: [(Value, String)]) -> some View {
        Picker(title, selection: selection) {
            ForEach(options, id: \.0) { value, label in
                Text(label).tag(value)
            }
        }
    }
}

#Preview {
    ContentView()
}
