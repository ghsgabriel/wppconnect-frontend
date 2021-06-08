import React, {useEffect, useMemo, useRef, useState} from "react";
import {ChatContainer, Contador, Container, ContentContainer, HeaderContact, Layout, WaitingContainer} from "./style";
import {CheckCircle, Mic, Paperclip, Send, XCircle} from "react-feather";
import api from "../../services/api";
import ImageLoader from "../../assets/ic_loader_chat.svg";
import ChatComponent from "../../components/ChatPage/ChatComponent";
import ConversasComponent from "../../components/ChatPage/ConversasComponent";
import {getSession, getToken} from "../../services/auth";
import config from "../../util/sessionHeader";
import MicRecorder from "mic-recorder-to-mp3";
import BackdropComponent from "../../components/BackdropComponent";
import NotificationSound from "../../assets/notification.mp3";
import {listenerMessages} from "../../services/socket-listener";

const SendMessagePage = () => {
    const dropRef = useRef(null);
    const [allMessages, setAllMessages] = useState([]);
    const [chats, setChats] = useState([]);
    const [dados, setDados] = useState([]);
    const [choosedContact, setChoosedContact] = useState([]);
    const [message, setMessage] = useState("");
    const chatRef = useRef(null);
    const messagesEnd = useRef(null);
    const [recordState, setRecordState] = useState(null);
    const [segundos, setSegundos] = useState(0);
    const [minutos, setMinutos] = useState(0);
    const [stop, setStop] = useState(true);
    const [isBlocked, setIsBlocked] = useState(false);
    const recorder = useMemo(() => new MicRecorder({bitRate: 128}), []);
    const [openLoading, setOpenLoading] = useState(false);
    const [contacts, setContacts] = useState([]);
    let messagesMinutes = [];

    useEffect(() => {
        async function checkConnection() {
            try {
                await api.get(`${getSession()}/check-connection-session`, config());
                await getAllChats();
                await getAllContacts();
            } catch (e) {
                // history.push("/");
            }
        }

        checkConnection();

        return () => {
            setChats([]);

        };
    }, []);

    useEffect(() => {
        if (stop === false) {
            const intervalId = setInterval(() => {
                setSegundos(seconds => {
                    if (seconds >= 59) {
                        zerar();
                        incrementarMinuto();
                    }

                    return seconds + 1;
                });
            }, 1000);

            return () => {
                clearInterval(intervalId);
            };
        }
    }, [segundos, stop]);

    listenerMessages((err, data) => {
        if (err) return;

        if (!data.response.fromMe) {
            const audio = new Audio(NotificationSound);
            audio.play();
        }

        (async function () {
            const {data: {response}} = await api.get(`${getSession()}/all-chats-with-messages`, config());

            const arr = [];
            for (const elem of response) {
                if (!elem.archive) {
                    arr.push(elem);
                }
            }

            setChats(arr);
            setDados(arr);
        })()

        if (chatRef.current !== null) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }

        if (choosedContact.id !== undefined) {
            if (choosedContact.id === data.response.chatId || data.response.fromMe && choosedContact.id._serialized === data.response.to) {
                setAllMessages((prevState) => {
                    return [...prevState, data.response];
                });
                scrollToBottom();
            }
        }
    });

    async function getAllContacts() {
        const {data} = await api.get(`${getSession()}/all-contacts`, config());
        const arr = [];

        for (const contact of data.response) {
            if (contact.isMyContact && contact.id.user !== undefined)
                arr.push(contact);
        }

        setContacts(arr);
    }

    function zerarCronometro() {
        setSegundos(0);
        setMinutos(0);
    }

    const startRecording = () => {
        navigator.getUserMedia({audio: true},
            () => {
                // alert("Permission Granted");
                setIsBlocked(false);
            },
            () => {
                alert("Permission Denied");
                setIsBlocked(true);
            },
        );

        if (isBlocked) {
            alert("Permission Denied");
        } else {
            recorder.start().then(() => {
                setRecordState(true);
                setStop(false);
            }).catch((e) => {
                console.error(e);
            });
        }
    };

    function cancelRecording() {
        // mediaRecorder.stop();

        setRecordState(null);
        setStop(true);
        zerarCronometro();
    }

    const finishRecording = () => {
        setRecordState(null);
        setStop(true);
        zerarCronometro();

        recorder.stop().getMp3().then(([buffer, blob]) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async function () {
                const base64data = reader.result;
                await api.post(`${getSession()}/send-voice`, {
                    url: base64data,
                    phone: choosedContact.id.user,
                }, config());
            };

            const file = new File(buffer, "audio.mp3", {
                type: blob.type,
                lastModified: Date.now()
            });
            new Audio(URL.createObjectURL(file));

        }).catch((e) => {
            alert("We could not retrieve your message");
            console.log(e);
        });
    };

    function incrementarMinuto() {
        setMinutos((prevState) => prevState + 1);
    }

    function zerar() {
        setSegundos(0);
    }

    async function getAllChats() {
        try {
            const {data: {response}} = await api.get(`${getSession()}/all-chats-with-messages`, config());

            const arr = [];
            for (const elem of response) {
                if (!elem.archive) {
                    arr.push(elem);
                }
            }

            setChats(arr);
            setDados(arr);
        } catch (e) {
            const {data: {response}} = await api.get(`${getSession()}/all-chats-with-messages`, config());

            const arr = [];
            for (const elem of response) {
                if (!elem.archive) {
                    arr.push(elem);
                }
            }

            setChats(arr);
            setDados(arr);
        }
    }

    const scrollToBottom = () => {
        if (messagesEnd.current !== null) {
            messagesEnd.current.scrollIntoView({behavior: "smooth"});
        }
    };

    async function onClickContact(contact) {
        setChoosedContact(contact);
        setOpenLoading(true);

        try {
            if (contact.id.includes("@g.us")) {
                const {data} = await api.get(`${getSession()}/chat-by-id/${contact.id.replace("@g.us", "").replace("@g.us", "")}?isGroup=true`, config());
                await api.post(`${getSession()}/send-seen`, {phone: contact.id.replace("@g.us", "")}, config());
                setAllMessages(data.response);
            } else {
                const {data} = await api.get(`${getSession()}/chat-by-id/${contact.id.replace("@c.us", "").replace("@c.us", "")}?isGroup=false`, config());
                await api.post(`${getSession()}/send-seen`, {phone: contact.id.replace("@c.us", "")}, config());
                setAllMessages(data.response);
            }
        } catch (e) {
            console.log(e);
        }

        scrollToBottom();
        contact.unreadCount = 0;
        setOpenLoading(false);
    }

    async function sendMessage(e) {
        e.preventDefault();
        if (message !== "" || getSession() !== "") {
            setMessage("");
            scrollToBottom();

            if (choosedContact.id.includes("@c.us")) {
                await api.post(`${getSession()}/send-message`, {
                    phone: choosedContact.id.replace("@c.us", ""),
                    message: message
                }, config());
            } else {
                await api.post(`${getSession()}/send-message`, {
                    phone: choosedContact.id.replace("@g.us", ""),
                    message: message,
                    isGroup: true
                }, config());
            }
        } else {
            alert("Preencha todos os dados antes de enviar");
        }
    }

    function checkIfSendHeader(message){
        let dt = new Date(message.timestamp * 1000);
        let minute = ("0" + dt.getMinutes()).substr(-2);
        if(!messagesMinutes[message.from]){
            messagesMinutes[message.from] = [];
        }
        if(!messagesMinutes[message.from][minute]){
            messagesMinutes[message.from][minute] = true;
            return true;
        }
        return false;
    }
    function onChangeAnexo(e) {
        if (e.target.files && e.target.files[0]) {
            let reader = new FileReader();
            let filename = "";

            reader.onload = async function (e) {
                const base64 = e.target.result;
                await api.post(`${getSession()}/send-file-base64`, {
                    base64: base64,
                    phone: choosedContact.id.replace("@c.us"),
                    message: "",
                    filename: filename
                }, config());
            };

            reader.readAsDataURL(e.target.files[0]);
            filename = e.target.files[0].name;
        }
    }

    function searchChat(e) {
        const {value} = e.target;

        const filterContact = contacts.filter((filtro) => {
                if (filtro.name && filtro.id._serialized) {
                    return filtro.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().indexOf(value.toLowerCase()) > -1 || filtro.id._serialized.indexOf(value) > -1;
                } else {
                    return [];
                }
            }
        );

        const filterChat = chats.filter((filtro) => {
                if (filtro.name && filtro.id) {
                    return filtro.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().indexOf(value.toLowerCase()) > -1 || filtro.id.indexOf(value) > -1;
                } else {
                    return [];
                }
            }
        );

        const searchArr = [];

        for (const chat of filterChat) {
            searchArr.push({
                name: chat.name,
                id: chat.id,
                unreadCount: 0,
            })
        }

        for (const contact of filterContact) {
            searchArr.push({
                name: contact.name,
                id: contact.id._serialized,
                unreadCount: 0,
                msgs: null
            })
        }

        const filterArr = removeDuplicates(searchArr);
        setChats(filterArr);

        if (value === "") {
            setChats(dados);
        }
    }

    const removeDuplicates = (arr) => {
        return arr.filter((item, index, self) => {
            if (item.name)
                return index === self.findIndex((t) => t.id === item.id && t.name && item.name)
        })
    }

    return (
        <Layout>
            <Container ref={dropRef}>
                <ContentContainer>
                    <ConversasComponent
                        chats={chats}
                        setChats={setChats}
                        onClickContact={onClickContact}
                        onSearch={searchChat}
                    />

                    <BackdropComponent open={openLoading}/>

                    <ChatContainer>
                        {
                            choosedContact.length <= 0 ?
                                null
                                : (
                                    <HeaderContact>
                                        <div className={"container-info-ctt"}>
                                            <img
                                                src={`https://ui-avatars.com/api/?name=${choosedContact.name}?background=random`}
                                                alt={choosedContact.name}
                                                loading={"lazy"}
                                                onError={(e) => e.target.src = "https://pbs.twimg.com/profile_images/1259926100261601280/OgmLtUZJ_400x400.png"}
                                            />
                                            <h3>
                                                {choosedContact.name === undefined ? choosedContact.id.replace("@c.us", "").replace("@g.us", "") : choosedContact.name}
                                            </h3>
                                        </div>
                                    </HeaderContact>
                                )
                        }

                        <ul ref={chatRef}>
                            {
                                allMessages.length <= 0 ? (
                                    <WaitingContainer>
                                        <div>
                                            <img src={ImageLoader} alt={"Smartphone"}/>
                                            <h2>
                                                Choose a contact to start a conversation
                                            </h2>
                                        </div>
                                    </WaitingContainer>
                                ) : (
                                    <div>
                                        {
                                            allMessages.map((message, index) => {
                                                return (
                                                    <li key={index}>
                                                        <ChatComponent
                                                            isMe={message.fromMe ? "right" : "left"}
                                                            session={getSession()}
                                                            token={getToken()}
                                                            message={message}
                                                            sendHeader={checkIfSendHeader(message)}
                                                        />
                                                    </li>
                                                );
                                            })
                                        }
                                    </div>
                                )
                            }

                            <div ref={messagesEnd}/>
                        </ul>

                        {
                            choosedContact.length <= 0 ? null : (
                                <form className={"bottom-container"} onSubmit={(e) => sendMessage(e)}>
                                    <label>
                                        <input type={"file"} onChange={onChangeAnexo}/>
                                        <div className={"attach-info"}>
                                            <Paperclip/>
                                        </div>
                                    </label>
                                    <input
                                        placeholder={"Digite uma mensagem..."}
                                        value={message}
                                        onChange={(e) => {
                                            setMessage(e.target.value);
                                        }}
                                    />

                                    {
                                        message === "" ? (
                                            recordState === null ? (
                                                <Mic onClick={startRecording}/>
                                            ) : (
                                                <Contador>
                                                    <div className={"main-cont"}>
                                                        <XCircle onClick={cancelRecording}/>
                                                        <div className={"counter"}>
                                                            <p>
                                                                {
                                                                    minutos === 0 ? (
                                                                        `${segundos}s`
                                                                    ) : (
                                                                        `${minutos}m ${segundos}s`
                                                                    )
                                                                }
                                                            </p>
                                                        </div>
                                                        <CheckCircle onClick={() => finishRecording()}/>
                                                    </div>
                                                </Contador>
                                            )
                                        ) : (
                                            <Send type={"submit"} onClick={(e) => sendMessage(e)}/>
                                        )
                                    }
                                </form>
                            )
                        }

                    </ChatContainer>
                </ContentContainer>
            </Container>
        </Layout>
    );
};

export default SendMessagePage;