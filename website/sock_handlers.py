import time

def add_sock_handlers(sock, engine):
    # flask-sock test
    @sock.route("/rest_ws")
    def rest_ws(ws):
        print("Received WS connection!")
        print(f"ws object: {ws}")
        time.sleep(0.3)
        ws.send("Hello there!")
        print("send websocket data")
        while True:
            data = ws.receive()
            print(f"received on websocket: data = {data}")
            ws.send(data)
