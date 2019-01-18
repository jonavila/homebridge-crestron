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
        public delegate void MessageHandler(Message message);

        public static event MessageHandler OnLightSwitchMessage;
        public static event MessageHandler OnLightDimmerMessage;
        public static event MessageHandler OnGenericSwitchMessage;
        /// <summary>
        /// SIMPL+ can only execute the default constructor. If you have variables that require initialization, please
        /// use an Initialize method
        /// </summary>
        public MessageBroker()
        {
        }

        public static void TriggerLightSwitchMessage(Message message)
        {
            OnLightSwitchMessage(message);
        }

        public static void TriggerLightDimmerMessage(Message message)
        {
            OnLightDimmerMessage(message);
        }

        public static void TriggerGenericSwitchMessage(Message message)
        {
            OnGenericSwitchMessage(message);
        }

        public static void ParseMessage(string messageJson)
        {
            var message = JsonConvert.DeserializeObject<Message>(messageJson);

            switch (message.DeviceType)
            {
                case "LightSwitch":
                    TriggerLightSwitchMessage(message);
                    break;

                case "LightDimmer":
                    TriggerLightDimmerMessage(message);
                    break;

                case "GenericSwitch":
                    TriggerGenericSwitchMessage(message);
                    break;
            }
        }

        public static string SerializeMessage(Message message)
        {
            return JsonConvert.SerializeObject(message);
        }
    }
}
