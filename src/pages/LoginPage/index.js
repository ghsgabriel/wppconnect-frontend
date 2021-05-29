import React, {useEffect, useRef, useState} from "react";
import {makeStyles} from "@material-ui/core/styles";
import Modal from "@material-ui/core/Modal";
import Backdrop from "@material-ui/core/Backdrop";
import Fade from "@material-ui/core/Fade";
import {Container, Description, Formulario, ImageCustom, Layout, Title} from "./style";
import {X} from "react-feather";
import api, {socket} from "../../services/api";
import history from "../../history";
import ModalMenu from "../../components/MenuModal";
import ErrorModal from "../../components/ErrorModal";
import BackdropComponent from "../../components/BackdropComponent";
import {useLocation} from "react-router-dom";
import {login} from "../../services/auth";
import LoginImage from "../../assets/login-v2.72cd8a26.svg";

const useStyles = makeStyles((theme) => ({
    modal: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    paper: {
        backgroundColor: theme.palette.background.paper,
        border: 0,
        outline: 0,
        boxShadow: theme.shadows[5],
        padding: 0,
        width: "100%",
        height: "100%"
    },
}));

export default function NewSessionPage() {
    const classes = useStyles();
    const [open,] = useState(true);
    const [session, setSession] = useState("");
    const [token, setToken] = useState("");
    const [qrCode, setQrCode] = useState("");
    const [openBackdrop, setOpenBackdrop] = useState(false);
    const [openMenuModal, setOpenMenuModal] = useState(false);
    const [openErrorModal, setOpenErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [titleError, setTitleError] = useState("");
    const animationRef = useRef(null);
    const layoutRef = useRef(null);

    const {state: haveLogin} = useLocation();

    useEffect(() => {
        socket.on("qrCode", (qrCode) => {
            if (session === qrCode.session) {
                setQrCode(qrCode.data);
                handleCloseBackdrop();
                if (animationRef.current !== null) {
                    animationRef.current.classList.remove("animation");
                }
            }
        });

        socket.off("session-logged").on("session-logged", (status) => {
            if (status.session === session) {
                if (layoutRef.current !== null) {
                    layoutRef.current.classList.add("saida-bottom-top");
                }

                if(status.token) {
                    insertLocalStorage();
                    history.push("/chat");
                }
            }
        });
    }, [session]);

    async function submitSession(e) {
        e.preventDefault();


        if (session === "") {
            handleOpenErrorModal();
            setTitleError("Preencha todos os campos");
            setErrorMessage("Você precisa preencher todos os campos antes de continuar.");
        } else {
            handleToggleBackdrop();
            await startSession();
        }
    }

    function insertLocalStorage() {
        const tokenId = document.querySelector("#token").getAttribute("value");
        const sessionId = document.querySelector("#session").getAttribute("value");

        login(JSON.stringify({session: sessionId, token: tokenId}));
    }

    async function startSession() {
        try {
            const config = {
                headers: {Authorization: `Bearer ${token}`}
            };

            const checkConn = await api.get(`${session}/check-connection-session`, config);
            if (!checkConn.data.status) {
                await signSession();
            } else {
                insertLocalStorage();
                history.push("/chat");
            }
        } catch (e) {
            setTimeout(function () {
                handleCloseBackdrop();
                handleOpenErrorModal();
                setTitleError("Oops... Algo deu errado.");
                setErrorMessage("Verifique se a sessão e o token estão corretos.");
            }, 2000);
        }
    }

    async function signSession() {
        const config = {
            headers: {Authorization: `Bearer ${token}`}
        };

        await api.post(`${session}/start-session`, null, config);
    }

    const handleCloseBackdrop = () => {
        setOpenBackdrop(false);
    };

    const handleToggleBackdrop = () => {
        setOpenBackdrop(!openBackdrop);
    };

    const handleCloseModal = () => {
        setOpenMenuModal(false);
    };

    const handleOpenModal = () => {
        setOpenMenuModal(true);
    };

    const handleCloseErrorModal = () => {
        setOpenErrorModal(false);
    };

    const handleOpenErrorModal = () => {
        setOpenErrorModal(true);
    };

    return (
        <div>
            <Modal
                aria-labelledby="transition-modal-title"
                aria-describedby="transition-modal-description"
                className={classes.modal}
                open={open}
                closeAfterTransition
                BackdropComponent={Backdrop}
                BackdropProps={{
                    timeout: 500,
                }}
            >
                <Fade in={open}>
                    <Layout className={classes.paper}>
                        <ModalMenu handleClose={handleCloseModal} open={openMenuModal}/>
                        <ErrorModal handleClose={handleCloseErrorModal} open={openErrorModal}
                                    errorMessage={errorMessage}
                                    titleError={titleError}/>
                        <BackdropComponent open={openBackdrop}/>

                        {
                            haveLogin !== undefined ?
                                <div className={"close-item"} onClick={() => history.goBack()}>
                                    <X/>
                                </div>
                                : null
                        }

                        <Container>
                            <div className={"container-session"}>
                                <div id={"left-div"}>
                                    <img src={LoginImage} alt={"Login Team"}/>
                                </div>

                                <div id={"right-div"}>
                                    {
                                        qrCode === "" ? null : (
                                            <div style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                justifyContent: "center",
                                                alignItems: "center"
                                            }}>
                                                <ImageCustom
                                                    ref={animationRef}
                                                    className={"animation noselect"}
                                                    autoplay
                                                    src={qrCode}
                                                    alt={"Smartphone"}
                                                    draggable={"false"}
                                                />
                                                <Title>
                                                    Scan QRCode
                                                </Title>
                                            </div>
                                        )
                                    }

                                    {
                                        qrCode !== "" ? null : (
                                            <Formulario onSubmit={(e) => submitSession(e)}>
                                                <Title id={"title"}>
                                                    Entre com sua sessão
                                                </Title>

                                                <Description id={"description"}>
                                                    Digite o nome da sessão e token para entrar em sua conta
                                                </Description>

                                                <div className={"top-info"}>
                                                    <small>
                                                        Sessão
                                                    </small>
                                                </div>
                                                <input
                                                    id={"session"}
                                                    autoComplete="off"
                                                    placeholder="Nome da sessão"
                                                    value={session}
                                                    onChange={(e) => setSession(e.target.value)}
                                                />

                                                <div className={"top-info"}>
                                                    <small>
                                                        Token
                                                    </small>

                                                    <span onClick={() => handleOpenModal()}>
                                                        Não sabe o token?
                                                    </span>
                                                </div>

                                                <input
                                                    id={"token"}
                                                    autoComplete="off"
                                                    placeholder="Token"
                                                    value={token}
                                                    onChange={(e) => setToken(e.target.value)}
                                                />

                                                <button type="submit" id="send-btn">
                                                    Enviar
                                                </button>
                                            </Formulario>
                                        )
                                    }
                                </div>
                            </div>

                        </Container>
                    </Layout>
                </Fade>
            </Modal>
        </div>
    );
}