import React from 'react';
import App from 'next/app';
import { Store } from 'redux';
import { Provider as ReduxProvider } from 'react-redux';
import withRedux from 'next-redux-wrapper';
import * as Sentry from '@sentry/browser';
import { initStore } from '@suite/reducers/store';
import Preloader from '@suite-components/Preloader';
import ToastContainer from '@suite-components/ToastContainer';
import Router from '@suite-support/Router';
import OnlineStatus from '@suite-support/OnlineStatus';
import BridgeStatus from '@desktop/support/BridgeStatus';
import IntlProvider from '@suite-support/ConnectedIntlProvider';
import ErrorBoundary from '@suite-support/ErrorBoundary';
import DesktopUpdater from '@desktop/support/DesktopUpdater';
import { SENTRY_CONFIG } from '@suite-config';
import Resize from '@suite-support/Resize/Container';
import NoSSR from '@suite-support/NoSSR';
import { isDev } from '@suite-utils/build';
import styled from 'styled-components';
import DesktopTitlebar from '@desktop/support/DesktopTitlebar';

interface Props {
    store: Store;
}

const titlebarHeight = 40;
const resizeHandlerPadding = 4;
const TitlebarWrapper = styled.div`
    display: block;
    position: fixed;
    z-index: 1000000;
    height: ${titlebarHeight}px;
    width: 100%;

    &:after {
        position: fixed;
        width: calc(100% - ${resizeHandlerPadding * 2}px);
        height: ${titlebarHeight - resizeHandlerPadding}px;
        content: '';
        display: block;
        top: ${resizeHandlerPadding}px;
        left: ${resizeHandlerPadding}px;
        z-index: 0;
        -webkit-user-select: none;
        -webkit-app-region: drag;
    }
`;

const MainWrapper = styled.div`
    height: calc(100% - ${titlebarHeight}px);
    margin-top: ${titlebarHeight}px;
    overflow-y: auto;
`;

class TrezorSuiteApp extends App<Props> {
    componentDidMount() {
        if (!isDev()) {
            Sentry.init(SENTRY_CONFIG);
            Sentry.configureScope(scope => {
                scope.setTag('version', process.env.VERSION || 'undefined');
            });
        }
        window.desktopApi!.clientReady();
    }

    render() {
        const { Component, pageProps, store } = this.props;

        return (
            <>
                <NoSSR>
                    <TitlebarWrapper>
                        <DesktopTitlebar />
                    </TitlebarWrapper>
                </NoSSR>
                <MainWrapper>
                    <ReduxProvider store={store}>
                        <ErrorBoundary>
                            <Resize />
                            <OnlineStatus />
                            <IntlProvider>
                                <DesktopUpdater />
                                <Router />
                                <BridgeStatus />
                                <ToastContainer />
                                <Preloader>
                                    <Component {...pageProps} />
                                </Preloader>
                            </IntlProvider>
                        </ErrorBoundary>
                    </ReduxProvider>
                </MainWrapper>
            </>
        );
    }
}

export default withRedux(initStore)(TrezorSuiteApp);
