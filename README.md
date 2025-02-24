Thoses test are designed to exercise the functionality of the Voting contract, ensuring ~90% coverage. Key aspects covered include:

    Initial State:
    Verifies that the contract initializes with the correct workflow status (RegisteringVoters).

    Voter Registration:
    Ensures that only the contract owner can register voters and that duplicate registrations or attempts outside the voter-registration phase are correctly reverted.

    Proposals Registration:
    Tests the transition to proposal registration, including:
        Allowing only the owner to start the proposal registration phase.
        Allowing only registered voters to submit proposals with valid descriptions.
        Rejecting proposals submitted in the wrong phase or with empty descriptions.
        Ending the proposals registration phase only when in the proper state.

    Voting Session:
    Validates the voting process:
        Starting the voting session after proposals have been registered.
        Allowing only registered voters to cast a vote.
        Preventing double-voting, votes for non-existent proposals, or votes when the session is inactive.
        Ending the voting session correctly.

    Vote Tallying and Winner Determination:
    Covers the final steps of the election process:
        Tallying votes and updating the winning proposal.
        Retrieving the winning proposal only after votes are tallied.
        Ensuring that calls to tally or retrieve a winner in an incorrect state are reverted.
        Handling edge cases, such as when no proposals were registered.

You can run the tests and generate a coverage report using the following commands:

npx hardhat test  
npx hardhat coverage
