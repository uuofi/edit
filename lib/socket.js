import { io } from "socket.io-client";
import { API_BASE_URL, getToken } from "./api";

let socketInstance = null;

export const getSocket = async () => {
  if (socketInstance && socketInstance.connected) return socketInstance;
  const token = await getToken();
  socketInstance = io(API_BASE_URL, {
    transports: ["websocket", "polling"],
    auth: { token },
    autoConnect: true,
  });
  return socketInstance;
};

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};
