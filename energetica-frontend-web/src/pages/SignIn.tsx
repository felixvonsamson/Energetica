import {Box, Button, Container, Link, Paper, Stack, TextField, Typography} from "@mui/material";
import EnergeticaLogo from "../assets/icon_green.svg";

export default function SignInPage () {
    return (
        <Box display={"flex"} flexDirection="column" height="100vh">
            {TopBar()}
            <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                flexGrow={1}
            >
                <Container maxWidth="xs">
                    <Stack spacing={2}>
                        { LoginBox() }
                        { SignupText() }
                    </Stack>
                </Container>
            </Box>
            <p>Some bottom text</p>
        </Box>
    );
}

function TopBar () {
    return <Stack
        p={2}
        spacing={2}
        direction="row"
        alignItems="center"
    >
        <img
            src={EnergeticaLogo}
            style={{"height": 70}}
            alt="Energetica logo"
        ></img>
        <Typography variant="h3" component="h1">
            Energetica
        </Typography>
    </Stack>;
}

function LoginBox () {
    return <Paper elevation={3}>
        <Box
            display="flex"
            justifyContent="center"
            borderRadius={10}
            gap={2}
        >
            <Stack direction={"column"} spacing={4} padding={2} sx={{"width": 1}}>
                <Typography variant="h4" component="h1">
                    Log In
                </Typography>
                <TextField id="username-textfield" label="Username"></TextField>
                <TextField id="password-textfield" label="Password"></TextField>
                <Button variant="contained" size="large">Sign in</Button>
            </Stack>
        </Box>
    </Paper>;
}

function SignupText () {
    return <Typography align="center">New to Energetica?{" "}
        <Link underline="hover">
            Sign up
        </Link>
        {" "}or{" "}
        <Link underline="hover">
            Learn more
        </Link>
    </Typography>;
}
