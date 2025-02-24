// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Voting is Ownable {

    enum WorkflowStatus { 
        RegisteringVoters,
        ProposalsRegistrationStarted,
        ProposalsRegistrationEnded,
        VotingSessionStarted,
        VotingSessionEnded,
        VotesTallied
    }

    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint votedProposalId;
    }

    struct Proposal {
        string description;
        uint voteCount;
    }

    WorkflowStatus public workflowStatus;
    mapping(address => Voter) public voters;
    Proposal[] public proposals;
    uint public winningProposalId;

    event VoterRegistered(address voterAddress);
    event WorkflowStatusChange(WorkflowStatus previousStatus, WorkflowStatus newStatus);
    event ProposalRegistered(uint proposalId);
    event Voted(address voter, uint proposalId);

    
    constructor() Ownable(msg.sender) {
        workflowStatus = WorkflowStatus.RegisteringVoters;
    }

    
    // Fonctions de gestion de la whitelist et des propositions
    

    function registerVoter(address _voterAddress) external onlyOwner {
        require(workflowStatus == WorkflowStatus.RegisteringVoters, "L'inscription des electeurs n'est pas active.");
        require(!voters[_voterAddress].isRegistered, "Electeur deja enregistre.");
        voters[_voterAddress] = Voter({ 
            isRegistered: true,
            hasVoted: false,
            votedProposalId: 0
        });
        emit VoterRegistered(_voterAddress);
    }

    function startProposalsRegistration() external onlyOwner {
        require(workflowStatus == WorkflowStatus.RegisteringVoters, "Le statut actuel doit etre 'RegisteringVoters'.");
        WorkflowStatus previousStatus = workflowStatus;
        workflowStatus = WorkflowStatus.ProposalsRegistrationStarted;
        emit WorkflowStatusChange(previousStatus, workflowStatus);
    }

    function registerProposal(string calldata _description) external {
        require(workflowStatus == WorkflowStatus.ProposalsRegistrationStarted, "L'enregistrement des propositions n'est pas actif.");
        require(voters[msg.sender].isRegistered, "Vous n'etes pas enregistre en tant qu'electeur.");
        require(bytes(_description).length > 0, "La description ne peut pas etre vide.");
        
        proposals.push(Proposal({
            description: _description,
            voteCount: 0
        }));
        uint proposalId = proposals.length - 1;
        emit ProposalRegistered(proposalId);
    }

    function endProposalsRegistration() external onlyOwner {
        require(workflowStatus == WorkflowStatus.ProposalsRegistrationStarted, "L'enregistrement des propositions n'est pas en cours.");
        WorkflowStatus previousStatus = workflowStatus;
        workflowStatus = WorkflowStatus.ProposalsRegistrationEnded;
        emit WorkflowStatusChange(previousStatus, workflowStatus);
    }

    
    // Fonctions de gestion du vote
   

    function startVotingSession() external onlyOwner {
        require(workflowStatus == WorkflowStatus.ProposalsRegistrationEnded, "Les propositions ne sont pas encore enregistrees.");
        WorkflowStatus previousStatus = workflowStatus;
        workflowStatus = WorkflowStatus.VotingSessionStarted;
        emit WorkflowStatusChange(previousStatus, workflowStatus);
    }

    function vote(uint _proposalId) external {
        require(workflowStatus == WorkflowStatus.VotingSessionStarted, "La session de vote n'est pas active.");
        require(voters[msg.sender].isRegistered, "Vous n'etes pas enregistre en tant qu'electeur.");
        require(!voters[msg.sender].hasVoted, "Vous avez deja vote.");
        require(_proposalId < proposals.length, "La proposition n'existe pas.");

        voters[msg.sender].hasVoted = true;
        voters[msg.sender].votedProposalId = _proposalId;
        proposals[_proposalId].voteCount += 1;

        emit Voted(msg.sender, _proposalId);
    }

    function endVotingSession() external onlyOwner {
        require(workflowStatus == WorkflowStatus.VotingSessionStarted, "La session de vote n'est pas en cours.");
        WorkflowStatus previousStatus = workflowStatus;
        workflowStatus = WorkflowStatus.VotingSessionEnded;
        emit WorkflowStatusChange(previousStatus, workflowStatus);
    }

    
    // Comptabilisation des votes et détermination du gagnant
    

    function tallyVotes() external onlyOwner {
        require(workflowStatus == WorkflowStatus.VotingSessionEnded, "La session de vote doit etre terminee.");
        uint winningVoteCount = 0;
        for (uint i = 0; i < proposals.length; i++) {
            if (proposals[i].voteCount > winningVoteCount) {
                winningVoteCount = proposals[i].voteCount;
                winningProposalId = i;
            }
        }
        WorkflowStatus previousStatus = workflowStatus;
        workflowStatus = WorkflowStatus.VotesTallied;
        emit WorkflowStatusChange(previousStatus, workflowStatus);
    }

    function getWinner() external view returns (Proposal memory) {
        require(workflowStatus == WorkflowStatus.VotesTallied, "Les votes n'ont pas encore ete comptabilises.");
        return proposals[winningProposalId];
    }
}
