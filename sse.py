from flask import Response, stream_with_context
import time
import json

def init_sse(app):

    @app.route('/predict_stream', methods=['GET'])
    def predict_stream():

        def event_stream():
            # ❗ Không gửi dữ liệu cũ khi client mới kết nối
            last_data = app.latest_prediction if hasattr(app, 'latest_prediction') else None

            while True:
                if hasattr(app, 'latest_prediction'):
                    current = app.latest_prediction
                    # Chỉ gửi nếu có dữ liệu MỚI
                    if current != last_data:
                        json_data = json.dumps(current)
                        yield f"data: {json_data}\n\n"
                        last_data = current
                time.sleep(0.5)

        return Response(stream_with_context(event_stream()), mimetype='text/event-stream')
