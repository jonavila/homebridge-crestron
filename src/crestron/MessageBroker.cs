using System;
using System.Text;
using Crestron.SimplSharp; // For Basic SIMPL# Classes
using Newtonsoft.Json;

namespace SSharpHomebridge
{
    public class Message
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
        public Message Message;
        /// <summary>
        /// SIMPL+ can only execute the default constructor. If you have variables that require initialization, please
        /// use an Initialize method
        /// </summary>
        public MessageBroker()
        {
        }

        public void ParseMessage(string messageJson)
        {
            Message = JsonConvert.DeserializeObject<Message>(messageJson);
        }

        public string SerializeMessage()
        {
            return JsonConvert.SerializeObject(Message);
        }
    }
}
