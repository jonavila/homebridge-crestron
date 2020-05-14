using System;
using System.Linq;
using System.Text;
using System.Collections.Generic;
using Crestron.SimplSharp;                          				// For Basic SIMPL# Classes
using Crestron.SimplSharp.CrestronSockets;

namespace SSharpHomebridge
{
    public class JsonMessageArgs : EventArgs
    {
        public string JsonMessage;
    }

    public class MultiClientTcpServer
    {
        public int BufferSize;
        public int MaxConnections;
        public int Port;
        public int Debug;
        public TCPServer TcpServer = null;
        public Dictionary<uint, bool> ClientConnectionTracker = new Dictionary<uint, bool>();
        public bool IsStarted = false;
        private readonly Dictionary<uint, string> _clientStringBuffer = new Dictionary<uint, string>();

        public event EventHandler<JsonMessageArgs> JsonMessage;

        protected virtual void OnJsonMessage(string jsonMessage)
        {
            if (Debug > 0)
            {
                CrestronConsole.PrintLine("*************************");
                CrestronConsole.PrintLine("TCP Server received the JSON message:");
                CrestronConsole.PrintLine(jsonMessage);
            }

            var jsonMessageArgs = new JsonMessageArgs
            {
                JsonMessage = jsonMessage
            };
            var handler = JsonMessage;
            if (handler != null)
            {
                handler(this, jsonMessageArgs);
            }
        }

        public void StartServer(int port, int bufferSize, int maxConnections)
        {
            Port = port;
            BufferSize = bufferSize;
            MaxConnections = maxConnections;
            IsStarted = true;
            try
            {
                if (Debug > 0)
                {
                    CrestronConsole.PrintLine("*************************");
                    CrestronConsole.PrintLine("TCP Server. StartServer.");
                }

                if (TcpServer == null || TcpServer.ServerSocketStatus == SocketStatus.SOCKET_STATUS_SOCKET_NOT_EXIST)
                {
                    if (Debug > 0) CrestronConsole.PrintLine("TCP Server Creating New.");
                    TcpServer = new TCPServer(IPAddress.Any.ToString(), Port, BufferSize,
                        EthernetAdapterType.EthernetLANAdapter, MaxConnections);
                    TcpServer.SocketStatusChange += SocketStatusChange;        //subscribe to class event, local C# method below
                    TcpServer.HandleLinkLoss();
                    TcpServer.HandleLinkUp();
                    if (Debug > 0)
                    {
                        CrestronConsole.PrintLine("TCP Server Created.");
                        CrestronConsole.PrintLine("Max Clients     :{0}", TcpServer.MaxNumberOfClientSupported);
                        CrestronConsole.PrintLine("Port            :{0}", TcpServer.PortNumber);
                        CrestronConsole.PrintLine("Accepted Address:{0}", TcpServer.AddressToAcceptConnectionFrom);
                        CrestronConsole.PrintLine("State           :{0}", TcpServer.State);
                    }

                    StartConnectionListener();

                    if (Debug > 0)
                        CrestronConsole.PrintLine("TCP Server. State           :{0}", TcpServer.State);
                }
                else
                {
                    if (Debug > 0)
                        CrestronConsole.PrintLine("TCP Server. Could not start. Current Socket Status:{0}", TcpServer.ServerSocketStatus);
                }
            }
            catch (Exception e)
            {
                CrestronConsole.PrintLine("TCP Server. Exception StartServer");
                CrestronConsole.PrintLine("Message:");
                CrestronConsole.PrintLine("{0}", e.Message);
            }
        }

        public void Send(SimplSharpString str)
        {
            //send to all clients
            if (Debug > 0)
            {
                CrestronConsole.PrintLine("*************************");
                CrestronConsole.PrintLine("TCP Server. Send");
            }
            if (ClientConnectionTracker.Count != TcpServer.NumberOfClientsConnected)
                CrestronConsole.PrintLine("TCP Server. connection tracker mismatch with connected clients");

            var b = str.ToString().ToCharArray().Select(c => (byte)c).ToArray();

            for (uint x = 1; x <= TcpServer.MaxNumberOfClientSupported; x++)
            {
                if (!ClientConnectionTracker.ContainsKey(x)) continue;
                if (ClientConnectionTracker[x])
                    TcpServer.SendDataAsync(x, b, b.Length, Sent);
            }
        }

        private void Sent(TCPServer server, uint clientIndex, int size)
        {
            if (Debug > 0)
            {
                CrestronConsole.PrintLine("*************************");
                CrestronConsole.PrintLine("TCP Server. Sent Client:{0} Size:{1}", clientIndex, size);
            }

            if (size < 0)
            {
                CrestronConsole.PrintLine("TCP Server. Sent invalid size. Assuming Client is disconnected.");
                try
                {
                    if (!TcpServer.ClientConnected(clientIndex)) return;
                    CrestronConsole.PrintLine("TCP Server. Server thinks client is connected. Disconnecting client.");
                    TcpServer.Disconnect(clientIndex);
                }
                catch (Exception e)
                {
                    CrestronConsole.PrintLine("TCP Server. Exception StartServer");
                    CrestronConsole.PrintLine("Message:");
                    CrestronConsole.PrintLine("{0}", e.Message);
                }
                finally
                {
                    if (ClientConnectionTracker.ContainsKey(clientIndex))
                    {
                        CrestronConsole.PrintLine("TCP Server. Removing from tracker");
                        ClientConnectionTracker.Remove(clientIndex);
                    }
                    if (_clientStringBuffer.ContainsKey(clientIndex))
                    {
                        CrestronConsole.PrintLine("TCP Server. Removing client from buffer dictionary");
                        _clientStringBuffer.Remove(clientIndex);
                    }
                }
            }
            else
            {
                if (ClientConnectionTracker.ContainsKey(clientIndex)) return;
                CrestronConsole.PrintLine("TCP Server. Sent successful. Adding client to tracker");
                ClientConnectionTracker.Add(clientIndex, true);
            }
        }

        public void SendToClient(uint clientIndex, SimplSharpString str)
        {
            try
            {
                if (Debug > 0)
                {
                    CrestronConsole.PrintLine("*************************");
                    CrestronConsole.PrintLine("TCP Server. SendToClient {0}", clientIndex);
                }

                var b = Encoding.ASCII.GetBytes(str.ToString());

                if (TcpServer.NumberOfClientsConnected > 1)
                    TcpServer.SendData(clientIndex, b, b.Length);
                else if (TcpServer.NumberOfClientsConnected == 1)
                    TcpServer.SendData(b, b.Length);
                else
                    if (Debug > 0) CrestronConsole.PrintLine("TCP Server. No Clients connected. String not sent");
            }
            catch (Exception e)
            {
                CrestronConsole.PrintLine("TCP Server. Exception SendString");
                CrestronConsole.PrintLine("Message:");
                CrestronConsole.PrintLine("{0}", e.Message);
            }
        }

        private void StartConnectionListener()
        {
            if (Debug > 0)
            {
                CrestronConsole.PrintLine("*************************");
                CrestronConsole.PrintLine("TCP Server. StartConnectionListener");
            }

            var err = TcpServer.WaitForConnectionAsync(ClientConnected);

            if (Debug > 0)
                CrestronConsole.PrintLine("TCP Server. WaitForConnectionAsync Result:{0}", err);
        }

        private void StartReceiveDataListener(uint clientIndex)
        {
            if (Debug > 0)
            {
                CrestronConsole.PrintLine("*************************");
                CrestronConsole.PrintLine("TCP Server. StartReceiveDataListener");
            }

            var err = TcpServer.ReceiveDataAsync(clientIndex, ReceiveDataFromClient);

            if (Debug > 0)
                CrestronConsole.PrintLine("TCP Server. ReceiveDataAsync Result:{0}", err);
        }

        private void SocketStatusChange(TCPServer server, uint clientIndex, SocketStatus status)
        {
            try
            {
                if (Debug > 0)
                {
                    CrestronConsole.PrintLine("*************************");
                    CrestronConsole.PrintLine("TCP Server. TCPServerSocketStatusChangeEventHandler {0},{1}", clientIndex, status);
                    CrestronConsole.PrintLine("TCP Server. State        :{0}", TcpServer.State);
                    CrestronConsole.PrintLine("TCP Server. Clients      :{0}", TcpServer.NumberOfClientsConnected);
                    CrestronConsole.PrintLine("TCP Server. Tracker Count:{0}", ClientConnectionTracker.Count);
                    foreach (var data in ClientConnectionTracker)
                        CrestronConsole.PrintLine("TCP Server. Tracker[{0}] :{0}", data.Key, data.Value);
                }

                switch (status)
                {
                    case SocketStatus.SOCKET_STATUS_CONNECTED:
                        if (Debug > 0) CrestronConsole.PrintLine("TCP Server. Status Connected.");
                        if (ClientConnectionTracker.ContainsKey(clientIndex))
                        {
                            if (Debug > 0) CrestronConsole.PrintLine("TCP Server. Client Key Found. Changing Value to True.");
                            ClientConnectionTracker[clientIndex] = true;
                        }
                        else
                        {
                            if (Debug > 0) CrestronConsole.PrintLine("TCP Server. Client Key Not Found. Adding Client Index {0}", clientIndex);
                            ClientConnectionTracker.Add(clientIndex, true);
                            _clientStringBuffer.Add(clientIndex, "");
                        }
                        break;
                    case SocketStatus.SOCKET_STATUS_NO_CONNECT:
                        if (Debug > 0) CrestronConsole.PrintLine("TCP Server. Status No Connect.");
                        if (ClientConnectionTracker.ContainsKey(clientIndex))
                            ClientConnectionTracker.Remove(clientIndex);
                        if (_clientStringBuffer.ContainsKey(clientIndex))
                            _clientStringBuffer.Remove(clientIndex);
                        if (IsStarted)
                            StartConnectionListener();
                        break;
                    default:
                        if (Debug > 0) CrestronConsole.PrintLine("TCP Server. Status Other.");
                        if (ClientConnectionTracker.ContainsKey(clientIndex))
                        {
                            if (Debug > 0) CrestronConsole.PrintLine("TCP Server. Client Key Found. Changing Value to False.");
                            ClientConnectionTracker[clientIndex] = false;
                        }
                        else
                        {
                            if (Debug > 0) CrestronConsole.PrintLine("TCP Server. Client Key Not Found. No data updated.");
                        }
                        break;
                }
            }
            catch (Exception e)
            {
                CrestronConsole.PrintLine("TCP Server. Exception TCPServerSocketStatusChangeEventHandler");
                CrestronConsole.PrintLine("Message:");
                CrestronConsole.PrintLine("{0}", e.Message);
            }
        }

        private void ClientConnected(TCPServer server, uint clientIndex)
        {
            try
            {
                if (Debug > 0)
                {
                    CrestronConsole.PrintLine("*************************");
                    CrestronConsole.PrintLine("TCP Server. ClientConnected {0}", clientIndex);
                }
                if (clientIndex > 0)
                {
                    if (ClientConnectionTracker.ContainsKey(clientIndex) == false)
                    {
                        ClientConnectionTracker.Add(clientIndex, true);
                    }
                    else
                        ClientConnectionTracker[clientIndex] = true;

                    StartReceiveDataListener(clientIndex);

                    //start another connection listener!
                    if (TcpServer.NumberOfClientsConnected < TcpServer.MaxNumberOfClientSupported)
                        StartConnectionListener();
                    else
                        CrestronConsole.PrintLine("TCP Server. Cannot open any more client connections. Maximum Reached {0}", TcpServer.MaxNumberOfClientSupported);
                }
                else
                {
                    if (Debug > 0)
                    {
                        CrestronConsole.PrintLine("TCP Server. ClientConnected index is invalid.");
                    }
                }
            }
            catch (Exception e)
            {
                CrestronConsole.PrintLine("TCP Server. Exception ClientConnectedHandler");
                CrestronConsole.PrintLine("Message:");
                CrestronConsole.PrintLine("{0}", e.Message);
            }
        }

        private void ReceiveDataFromClient(TCPServer server, uint clientIndex, int lengthBytesReceived)
        {
            try
            {
                if (Debug > 0)
                {
                    CrestronConsole.PrintLine("*************************");
                    CrestronConsole.PrintLine("TCP Server. ServerReceiveFromClient {0},{1}", clientIndex, lengthBytesReceived);
                }

                if (lengthBytesReceived > 0)
                {
                    var rcv = server.GetIncomingDataBufferForSpecificClient(clientIndex);

                    if (Debug > 0)
                        CrestronConsole.PrintLine("Bytes:{0}", BitConverter.ToString(rcv).Substring(0, lengthBytesReceived * 3));

                    var currentStringBuffer = new string(rcv.Select(c => (char)c).ToArray());
                    var buffered = _clientStringBuffer[clientIndex] += currentStringBuffer;
                    var received = buffered.Split('\n');

                    while (received.Length > 1)
                    {
                        OnJsonMessage(received.First());
                        buffered = _clientStringBuffer[clientIndex] = string.Join("\n", received.Skip(1).ToArray());
                        received = buffered.Split('\n');

                    }

                    StartReceiveDataListener(clientIndex);
                }
                else
                {
                    if (Debug > 0) CrestronConsole.PrintLine("TCP Server. Received Bytes < 0");
                }

            }
            catch (Exception e)
            {
                CrestronConsole.PrintLine("TCP Server. Exception ServerReceiveFromClient");
                CrestronConsole.PrintLine("Message:");
                CrestronConsole.PrintLine("{0}", e.Message);
            }
        }

        public void StopServer()
        {
            IsStarted = false;
            try
            {
                if (Debug > 0)
                {
                    CrestronConsole.PrintLine("*************************");
                    CrestronConsole.PrintLine("TCP Server. StopServer");
                }
                TcpServer.DisconnectAll();
                TcpServer.Stop();
            }
            catch (Exception e)
            {
                CrestronConsole.PrintLine("TCP Server. Exception StopServer");
                CrestronConsole.PrintLine("Message:");
                CrestronConsole.PrintLine("{0}", e.Message);
            }
        }

        /// <summary>
        /// SIMPL+ can only execute the default constructor. If you have variables that require initialization, please
        /// use an Initialize method
        /// </summary>
        public MultiClientTcpServer()
        {
            CrestronConsole.PrintLine("MultiClientTcpServer initialized");
        }
    }
}