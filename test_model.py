"""
Script để kiểm tra và inspect PyTorch model
"""
import torch
import torch.nn as nn

def inspect_model(model_path='final_model.pth'):
    """Inspect model structure and information"""
    print("=" * 60)
    print("🔍 INSPECTING PYTORCH MODEL")
    print("=" * 60)
    
    try:
        # Load checkpoint
        print(f"\n📂 Loading: {model_path}")
        checkpoint = torch.load(model_path, map_location='cpu')
        
        print("\n📋 Checkpoint Type:", type(checkpoint))
        
        # Analyze checkpoint structure
        if isinstance(checkpoint, dict):
            print("\n🔑 Checkpoint Keys:")
            for key in checkpoint.keys():
                print(f"   - {key}")
                
            # Get state dict
            if 'model_state_dict' in checkpoint:
                state_dict = checkpoint['model_state_dict']
                print("\n✅ Found 'model_state_dict'")
            elif 'state_dict' in checkpoint:
                state_dict = checkpoint['state_dict']
                print("\n✅ Found 'state_dict'")
            else:
                state_dict = checkpoint
                print("\n✅ Using checkpoint as state_dict")
                
            # Print additional info if available
            if 'epoch' in checkpoint:
                print(f"   Epoch: {checkpoint['epoch']}")
            if 'accuracy' in checkpoint:
                print(f"   Accuracy: {checkpoint['accuracy']:.2%}")
            if 'loss' in checkpoint:
                print(f"   Loss: {checkpoint['loss']:.4f}")
                
        else:
            # Direct state dict
            state_dict = checkpoint
            print("\n✅ Checkpoint is direct state_dict")
        
        # Analyze model structure
        print("\n🏗️  MODEL ARCHITECTURE:")
        print("-" * 60)
        
        layer_names = list(state_dict.keys())
        print(f"Total layers/parameters: {len(layer_names)}")
        
        print("\n📊 First 10 layers:")
        for i, name in enumerate(layer_names[:10]):
            shape = state_dict[name].shape
            print(f"   {i+1}. {name:40s} → {shape}")
        
        print("\n📊 Last 5 layers:")
        for i, name in enumerate(layer_names[-5:]):
            shape = state_dict[name].shape
            print(f"   {len(layer_names)-4+i}. {name:40s} → {shape}")
        
        # Detect architecture hints
        print("\n🔍 ARCHITECTURE HINTS:")
        print("-" * 60)
        
        first_layer = layer_names[0]
        last_layer = layer_names[-1]
        
        print(f"First layer: {first_layer}")
        print(f"Last layer: {last_layer}")
        
        # Check for common architectures
        if 'resnet' in first_layer.lower():
            print("⚠️  Possible ResNet architecture")
        elif 'efficientnet' in first_layer.lower():
            print("⚠️  Possible EfficientNet architecture")
        elif 'mobilenet' in first_layer.lower():
            print("⚠️  Possible MobileNet architecture")
        elif 'vgg' in first_layer.lower():
            print("⚠️  Possible VGG architecture")
        else:
            print("⚠️  Custom CNN architecture")
        
        # Check output layer
        if 'fc' in last_layer or 'classifier' in last_layer or 'linear' in last_layer:
            output_shape = state_dict[last_layer].shape
            if len(output_shape) == 2:
                num_classes = output_shape[0]
                print(f"📈 Number of output classes: {num_classes}")
        
        # Calculate total parameters
        total_params = sum(p.numel() for p in state_dict.values())
        print(f"\n📊 Total parameters: {total_params:,}")
        print(f"   Size: {total_params * 4 / (1024**2):.2f} MB (float32)")
        
        print("\n" + "=" * 60)
        print("✅ INSPECTION COMPLETE")
        print("=" * 60)
        
        # Recommendations
        print("\n💡 NEXT STEPS:")
        print("   1. Share this output with your friend")
        print("   2. Ask for the exact model architecture code")
        print("   3. Or ask for the training script")
        print("\n   Model classes detected:")
        if 'fc' in last_layer or 'classifier' in last_layer:
            print(f"   → Binary classification (diseased/healthy)")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_with_common_architectures():
    """Try loading with common architectures"""
    print("\n" + "=" * 60)
    print("🧪 TESTING COMMON ARCHITECTURES")
    print("=" * 60)
    
    architectures = {
        'ResNet18': lambda: torch.hub.load('pytorch/vision:v0.10.0', 'resnet18', pretrained=False),
        'ResNet50': lambda: torch.hub.load('pytorch/vision:v0.10.0', 'resnet50', pretrained=False),
        'MobileNetV2': lambda: torch.hub.load('pytorch/vision:v0.10.0', 'mobilenet_v2', pretrained=False),
        'EfficientNet-B0': lambda: torch.hub.load('NVIDIA/DeepLearningExamples:torchhub', 'nvidia_efficientnet_b0', pretrained=False)
    }
    
    checkpoint = torch.load('final_model.pth', map_location='cpu')
    if isinstance(checkpoint, dict):
        state_dict = checkpoint.get('model_state_dict', checkpoint.get('state_dict', checkpoint))
    else:
        state_dict = checkpoint
    
    for name, create_model in architectures.items():
        try:
            print(f"\n🔄 Trying {name}...")
            model = create_model()
            
            # Modify output layer for binary classification
            if hasattr(model, 'fc'):
                model.fc = nn.Linear(model.fc.in_features, 2)
            elif hasattr(model, 'classifier'):
                if isinstance(model.classifier, nn.Sequential):
                    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, 2)
                else:
                    model.classifier = nn.Linear(model.classifier.in_features, 2)
            
            # Try loading
            model.load_state_dict(state_dict)
            print(f"✅ {name} MATCHES! Use this architecture.")
            return name
            
        except Exception as e:
            print(f"❌ {name} doesn't match")
    
    print("\n⚠️  No common architecture matched")
    print("   → Need custom architecture from training code")

if __name__ == '__main__':
    # Inspect model
    if inspect_model():
        print("\n" + "=" * 60)
        # Try common architectures
        test_with_common_architectures()