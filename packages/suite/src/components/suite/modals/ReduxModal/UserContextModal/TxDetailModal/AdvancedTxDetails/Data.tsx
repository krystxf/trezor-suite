import { WalletAccountTransaction } from '@suite-common/wallet-types';
import styled from 'styled-components';

interface DataProps {
    tx: WalletAccountTransaction;
}

const Container = styled.div`
    display: grid;
    grid-template-columns: 130px 3fr;
    gap: 10px;
    margin: auto;
`;

const ColumnName = styled.div`
    font-weight: bold;
    display: flex;
    align-items: center;
`;

const DataColumn = styled.div`
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background-color: #f9f9f9;
    color: black;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
`;

export const Data = ({ tx }: DataProps) => {
    const { data, parsedData } = tx.ethereumSpecific || {};
    const { function: func, methodId, name, params } = parsedData || {};

    return (
        <Container>
            {methodId && name ? (
                <>
                    <ColumnName>Method name:</ColumnName>
                    <DataColumn>
                        {name} ({methodId})
                    </DataColumn>
                </>
            ) : (
                <>
                    <ColumnName>Method:</ColumnName>
                    <DataColumn>{methodId}</DataColumn>
                </>
            )}
            {func && (
                <>
                    <ColumnName>Function:</ColumnName>
                    <DataColumn>{func}</DataColumn>
                </>
            )}
            {params && (
                <>
                    <ColumnName>Params:</ColumnName>
                    <DataColumn>{JSON.stringify(params, undefined, 2)}</DataColumn>
                </>
            )}
            {data && (
                <>
                    <ColumnName>Input data:</ColumnName>
                    <DataColumn>{data}</DataColumn>
                </>
            )}
        </Container>
    );
};
