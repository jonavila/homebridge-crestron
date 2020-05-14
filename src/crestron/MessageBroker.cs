using System;
using Crestron.SimplSharp;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace SSharpHomebridge
{
    public class Message : EventArgs
    {
        public ushort DeviceId;
        public string DeviceType;
        public string MessageType;
        public string Operation;
        public string Property;
        public ushort Value;
    }

    public class MessageBroker
    {
        private readonly MultiClientTcpServer _tcpServer;
        private readonly JsonSerializerSettings _jsonSerializerSettings = new JsonSerializerSettings
        {
            Error = delegate(object sender, ErrorEventArgs args)
            {
                CrestronConsole.PrintLine(args.ErrorContext.Error.Message);
                args.ErrorContext.Handled = true;
            }
        };

        public int Debug { get; set; }
        public event EventHandler<Message> Request;

        protected virtual void OnMessage(Message message)
        {
            if (Debug > 0)
            {
                CrestronConsole.PrintLine("*************************");
                CrestronConsole.PrintLine("Message Broker received a {0} {1} for:", message.Operation, message.MessageType);
                CrestronConsole.PrintLine("DeviceId: {0}, DeviceType: {1}, Property: {2}, Value: {3}", message.DeviceId, message.DeviceType, message.Property, message.Value);
            }

            var handler = Request;
            if (handler != null)
            {
                handler(this, message);
            }
        }


        public void StartTcpServer(int port, int bufferSize, int maxConnections)
        {
            _tcpServer.StartServer(port, bufferSize, maxConnections);
        }

        public void StopTcpServer()
        {
            _tcpServer.StopServer();
        }

        public void JsonMessageHandler(object source, JsonMessageArgs e)
        {
            var message = DeserializeJsonMessage(e.JsonMessage);
            OnMessage(message);
        }

        public void SendToHomebridge(Message message)
        {
            var jsonMessage = SerializeMessageToJson(message);
            if (Debug > 0)
            {
                CrestronConsole.PrintLine("*************************");
                CrestronConsole.PrintLine("About to send message to homebridge");
                CrestronConsole.PrintLine(jsonMessage);
            }
            _tcpServer.Send(jsonMessage + '\n');
        }

        private Message DeserializeJsonMessage(string jsonMessage)
        {
            return JsonConvert.DeserializeObject<Message>(jsonMessage, _jsonSerializerSettings);
        }

        private string SerializeMessageToJson(Message message)
        {
            return JsonConvert.SerializeObject(message, Formatting.None, _jsonSerializerSettings);
        }

        public void EnableDebug()
        {
            Debug = 1;
            _tcpServer.Debug = 1;
        }

        public void DisableDebug()
        {
            Debug = 1;
            _tcpServer.Debug = 1;
        }

        /// <summary>
        /// SIMPL+ can only execute the default constructor. If you have variables that require initialization, please
        /// use an Initialize method
        /// </summary>
        public MessageBroker()
        {
            _tcpServer = new MultiClientTcpServer();
            _tcpServer.JsonMessage += JsonMessageHandler;
            CrestronConsole.PrintLine("MessageBroker initialized");
        }
    }
}
