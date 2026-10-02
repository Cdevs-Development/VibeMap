# =====================================================
# IMPORTS
# =====================================================

from fastapi import WebSocket


# =====================================================
# CONNECTION MANAGER
# =====================================================

class ConnectionManager:

    def __init__(self):

        self.active_connections = {}

    async def connect(
        self,
        share_token: str,
        websocket: WebSocket
    ):

        await websocket.accept()

        if share_token not in self.active_connections:

            self.active_connections[
                share_token
            ] = []

        self.active_connections[
            share_token
        ].append(
            websocket
        )

    def disconnect(
        self,
        share_token: str,
        websocket: WebSocket
    ):

        if share_token in self.active_connections:

            self.active_connections[
                share_token
            ].remove(
                websocket
            )

            if len(
                self.active_connections[
                    share_token
                ]
            ) == 0:

                del self.active_connections[
                    share_token
                ]

    async def broadcast(
        self,
        share_token: str,
        message: dict
    ):

        if share_token not in self.active_connections:

            return

        for connection in self.active_connections[
            share_token
        ]:

            await connection.send_json(
                message
            )


# =====================================================
# GLOBAL INSTANCE
# =====================================================

manager = ConnectionManager()