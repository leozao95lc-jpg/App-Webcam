import AVFoundation
import SwiftUI
import UIKit

/// Preview local ligado à MESMA AVCaptureSession da captura. Não abre captura nova.
struct CameraPreviewView: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> PreviewUIView {
        let view = PreviewUIView()
        view.previewLayer.session = session
        view.previewLayer.videoGravity = .resizeAspect
        return view
    }

    func updateUIView(_ uiView: PreviewUIView, context: Context) {
        uiView.previewLayer.session = session
    }
}

final class PreviewUIView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }

    var previewLayer: AVCaptureVideoPreviewLayer {
        // layerClass garante o tipo; o forçado é seguro.
        layer as! AVCaptureVideoPreviewLayer // swiftlint:disable:this force_cast
    }
}
