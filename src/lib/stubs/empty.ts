/* Optional peer-dependency stub used by Next webpack aliases. */
const stub = () => ({});
export default stub;
export const pipe =
  (...fns: Array<(v: unknown) => unknown>) =>
  (value: unknown) =>
    fns.reduce((v, f) => f(v), value);
export const createTransactionMessage = stub;
export const setTransactionMessageFeePayerSigner = stub;
export const setTransactionMessageLifetimeUsingBlockhash = stub;
export const appendTransactionMessageInstruction = stub;
export const compileTransaction = stub;
export const getTransactionEncoder = stub;
export const findAssociatedTokenPda = stub;
export const getCreateAssociatedTokenIdempotentInstruction = stub;
export const getTransferInstruction = stub;
export const signTransactionMessageWithSigners = async () => ({});
export const sendAndConfirmTransactionFactory = stub;
export const createSolanaRpc = stub;
export const createSolanaRpcSubscriptions = stub;
export const createDefaultRpcTransport = stub;
export const sendTransaction = async () => ({});
export const getTransferSolInstruction = stub;
export const address = (v: string) => v;
export const createKeyPairSignerFromBytes = async () => ({});
