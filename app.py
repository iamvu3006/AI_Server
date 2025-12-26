from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image
import io
import base64
from datetime import datetime
import os

from sse import init_sse

app = Flask(__name__)
CORS(app)

# Flask: Framework web Python để tạo REST API
# CORS: Cho phép ESP32 (thiết bị khác domain) gọi API
# UPLOAD_FOLDER: Lưu trữ ảnh đã nhận để debug/xem lại

init_sse(app)

# Create folders for storing images
UPLOAD_FOLDER = 'received_images'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Global variables
model = None
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
IMG_SIZE = (256, 256)

def create_model():
    """Create ResNet18 with custom FC layer"""
    model = models.resnet18(weights=None)  # Updated API
    model.fc = nn.Sequential(
        nn.Dropout(0.5),
        nn.Linear(512, 1)
    )
    return model
# ResNet18: Mạng CNN 18 layers, đã được chứng minh hiệu quả cho phân loại ảnh
# Transfer Learning: Dùng kiến trúc ResNet nhưng train lại FC layer
# Binary Classification:

# Output = 1 neuron (không phải 2)
# Qua Sigmoid → xác suất [0, 1]
# ≥0.5 = Healthy, <0.5 = Diseased

def get_transform():
    """Image preprocessing for inference"""
    return transforms.Compose([
        transforms.Resize(IMG_SIZE), # Resize về kích thước chuẩn
        transforms.ToTensor(), # Chuyển sang tensor [0,1]
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406], # ImageNet standard
            std=[0.229, 0.224, 0.225]
        )
    ])
# Đây là chuẩn của ImageNet dataset (ResNet được pretrain trên đó)
# Giúp model hội tụ nhanh hơn và chính xác hơn

def load_model():
    """Load the trained PyTorch model"""
    global model
    
    try:
        print("📦 Loading PyTorch ResNet18 model...")
        
        model = create_model()
        state_dict = torch.load('final_model.pth', map_location=device)
        model.load_state_dict(state_dict)
        model.to(device)
        model.eval()
        
        print(f"✅ Model loaded successfully on {device}!")
        print(f"📊 Architecture: ResNet18 (custom FC layer)")
        print(f"📊 Parameters: {sum(p.numel() for p in model.parameters()):,}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error loading model: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def preprocess_image(image_data):
    """Preprocess image for model prediction"""
    try:
        if isinstance(image_data, bytes):
            image = Image.open(io.BytesIO(image_data))
        else:
            image = image_data
        
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        transform = get_transform()
        img_tensor = transform(image)
        img_tensor = img_tensor.unsqueeze(0)
        
        return img_tensor
        
    except Exception as e:
        print(f"❌ Error preprocessing: {str(e)}")
        return None

def predict_leaf(image_data):
    """Make prediction on leaf image"""
    try:
        # 1. Preprocess image
        img_tensor = preprocess_image(image_data)
        if img_tensor is None:
            return None
        img_tensor = img_tensor.to(device) # Chuyển lên GPU nếu có

        # 2. Inference
        with torch.no_grad(): # Không tính gradient (tiết kiệm RAM)
            output = model(img_tensor)
            probability = torch.sigmoid(output).item()
        
        # Determine class
        if probability >= 0.5:
            predicted_class = 'healthy'
            confidence_score = probability
        else:
            predicted_class = 'diseased'
            confidence_score = 1.0 - probability
        
        # Create result
        top_predictions = [
            {'label': 'healthy', 'confidence': float(probability)},
            {'label': 'diseased', 'confidence': float(1.0 - probability)}
        ]
        top_predictions.sort(key=lambda x: x['confidence'], reverse=True)
        
        result = {
            'predicted_class': predicted_class,
            'confidence': confidence_score,
            'top_3_predictions': top_predictions,
            'timestamp': datetime.now().isoformat()
        }
        
        print(f"🍃 {predicted_class} ({confidence_score:.2%}) | sigmoid: {probability:.4f}")
        
        return result
        
    except Exception as e:
        print(f"❌ Prediction error: {str(e)}")
        import traceback
        traceback.print_exc()
        return None
# Giải thích:
# torch.no_grad(): Tắt autograd → nhanh hơn, ít RAM hơn
# Sigmoid(output): Chuyển output [-∞, +∞] → [0, 1]
# Confidence: Luôn trả về confidence của class được chọn (>50%)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'device': str(device),
        'framework': 'PyTorch',
        'timestamp': datetime.now().isoformat()
    }), 200
#Mục đích: Kiểm tra server còn sống không, model đã load chưa

@app.route('/predict', methods=['POST'])
def predict():
    try:
        if model is None:
            return jsonify({'error': 'Model not loaded'}), 503
        
        if 'image' not in request.files and 'image' not in request.form:
            return jsonify({'error': 'No image provided'}), 400
        
        if 'image' in request.files:
            image_data = request.files['image'].read()
        else:
            base64_data = request.form['image']
            if ',' in base64_data:
                base64_data = base64_data.split(',')[1]
            image_data = base64.b64decode(base64_data)
        
        result = predict_leaf(image_data)
        
        if result is None:
            return jsonify({'error': 'Prediction failed'}), 500
        
        return jsonify({'success': True, 'data': result}), 200
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'error': str(e)}), 500
# Hỗ trợ 2 định dạng:
# Form-data file: Upload trực tiếp file ảnh
# Base64 string: Dùng cho web browser (Canvas → base64)

@app.route('/predict_esp32', methods=['POST'])
def predict_esp32():
    try:
        if model is None:
            return jsonify({'error': 'Model not ready'}), 503
        
        image_data = request.data
        if not image_data:
            return jsonify({'error': 'No image data'}), 400
        
        # Make prediction
        result = predict_leaf(image_data)
        if result is None:
            return jsonify({'error': 'Prediction failed'}), 500
        
        # Save image with timestamp and result
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        predicted_class = result['predicted_class']
        confidence = int(result['confidence'] * 100)
        
        filename = f"{timestamp}_{predicted_class}_{confidence}.jpg"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        with open(filepath, 'wb') as f:
            f.write(image_data)
        
        print(f"💾 Saved: {filename}")
        
        # Return result with image filename
        return jsonify({
            'class': result['predicted_class'],
            'conf': round(result['confidence'], 2),
            'image': filename,  # Add filename to response
            'timestamp': result['timestamp']
        }), 200
        
    except Exception as e:
        print(f"❌ ESP32 error: {str(e)}")
        return jsonify({'error': str(e)}), 500
# Điểm đặc biệt:

# Raw binary: ESP32 gửi trực tiếp byte stream JPEG (không qua encoding)
# Filename có metadata: Dễ debug, biết ngay kết quả dự đoán
# Response nhỏ gọn: ESP32 RAM hạn chế

@app.route('/classes', methods=['GET'])
def get_classes():
    return jsonify({
        'classes': ['diseased', 'healthy'],
        'total': 2
    }), 200

@app.route('/images/<filename>', methods=['GET'])
def get_image(filename):
    """Serve uploaded images"""
    try:
        return send_from_directory(UPLOAD_FOLDER, filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 404

@app.route('/images', methods=['GET'])
def list_images():
    """List all saved images"""
    try:
        files = os.listdir(UPLOAD_FOLDER)
        images = [f for f in files if f.endswith('.jpg')]
        images.sort(reverse=True)  # Newest first
        
        return jsonify({
            'images': images,
            'total': len(images)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
# Mục đích: Web dashboard có thể xem lại lịch sử ảnh đã chụp

if __name__ == '__main__':
    print("🚀 Starting AI Server (PyTorch ResNet18)...")
    
    if torch.cuda.is_available():
        print(f"✅ GPU: {torch.cuda.get_device_name(0)}")
    else:
        print("ℹ️  Running on CPU")
    
    if load_model():
        print("\n✅ Server ready!")
        print("📡 http://0.0.0.0:5000")
        print("\nEndpoints:")
        print("  GET  /health")
        print("  POST /predict")
        print("  POST /predict_esp32")
        print("  GET  /classes")
        print("  GET  /images")
        print("  GET  /images/<filename>")
        print("  GET  /stream (SSE for dashboard)")
        print(f"\n💾 Images saved to: {os.path.abspath(UPLOAD_FOLDER)}")
        print("\n💡 Model Info:")
        print("   Architecture: ResNet18 (custom FC with dropout)")
        print("   Output: Binary classification (diseased/healthy)")
        print("   Activation: Sigmoid (1 output neuron)")
        
        app.run(host='0.0.0.0', port=5000, debug=False)
    else:
        print("❌ Failed to load model")