const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Voting Contract", function () {
  let Voting, voting, owner, addr1, addr2, addr3;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
    Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy();
    await voting.waitForDeployment(); // for ethers v6
  });

  describe("Initial State", function () {
    it("should set the initial workflow status to RegisteringVoters", async function () {
      expect(await voting.workflowStatus()).to.equal(0); // 0 => RegisteringVoters
    });
  });

  describe("Voter Registration", function () {
    it("should allow the owner to register a voter", async function () {
      await expect(voting.registerVoter(addr1.address))
        .to.emit(voting, "VoterRegistered")
        .withArgs(addr1.address);
      const voter = await voting.voters(addr1.address);
      expect(voter.isRegistered).to.equal(true);
      expect(voter.hasVoted).to.equal(false);
    });

    it("should revert if a voter is already registered", async function () {
      await voting.registerVoter(addr1.address);
      await expect(voting.registerVoter(addr1.address)).to.be.revertedWith(
        "Electeur deja enregistre."
      );
    });

    it("should revert if non-owner tries to register a voter", async function () {
      await expect(voting.connect(addr1).registerVoter(addr2.address)).to.be.reverted;
    });

    it("should revert if trying to register a voter when not in RegisteringVoters state", async function () {
      await voting.registerVoter(addr1.address);
      // Change state to proposals registration phase
      await voting.startProposalsRegistration();
      await expect(voting.registerVoter(addr2.address)).to.be.revertedWith(
        "L'inscription des electeurs n'est pas active."
      );
    });
  });

  describe("Proposals Registration", function () {
    beforeEach(async function () {
      // Register voters once here
      await voting.registerVoter(addr1.address);
      await voting.registerVoter(addr2.address);
    });

    it("should allow owner to start proposals registration", async function () {
      await expect(voting.startProposalsRegistration())
        .to.emit(voting, "WorkflowStatusChange")
        .withArgs(0, 1); // From RegisteringVoters (0) to ProposalsRegistrationStarted (1)
      expect(await voting.workflowStatus()).to.equal(1);
    });

    it("should revert if non-owner tries to start proposals registration", async function () {
      await expect(voting.connect(addr1).startProposalsRegistration()).to.be.reverted;
    });

    it("should revert if startProposalsRegistration is called when not in RegisteringVoters", async function () {
      await voting.startProposalsRegistration();
      // Already in ProposalsRegistrationStarted so calling again should revert.
      await expect(voting.startProposalsRegistration()).to.be.revertedWith(
        "Le statut actuel doit etre 'RegisteringVoters'."
      );
    });

    it("should allow a registered voter to register a proposal", async function () {
      await voting.startProposalsRegistration();
      await expect(voting.connect(addr1).registerProposal("Proposal 1"))
        .to.emit(voting, "ProposalRegistered")
        .withArgs(0);
      const proposal = await voting.proposals(0);
      expect(proposal.description).to.equal("Proposal 1");
      expect(proposal.voteCount).to.equal(0);
    });

    it("should revert if proposal description is empty", async function () {
      await voting.startProposalsRegistration();
      await expect(voting.connect(addr1).registerProposal(""))
        .to.be.revertedWith("La description ne peut pas etre vide.");
    });

    it("should revert if non-registered voter tries to register a proposal", async function () {
      await voting.startProposalsRegistration();
      await expect(voting.connect(addr3).registerProposal("Proposal from addr3"))
        .to.be.revertedWith("Vous n'etes pas enregistre en tant qu'electeur.");
    });

    it("should revert if registerProposal is called when not in ProposalsRegistrationStarted", async function () {
      // Do not call startProposalsRegistration; use the existing registration from beforeEach.
      await expect(voting.connect(addr1).registerProposal("Test Proposal")).to.be.revertedWith(
        "L'enregistrement des propositions n'est pas actif."
      );
    });

    it("should allow owner to end proposals registration", async function () {
      await voting.startProposalsRegistration();
      await expect(voting.endProposalsRegistration())
        .to.emit(voting, "WorkflowStatusChange")
        .withArgs(1, 2); // From ProposalsRegistrationStarted (1) to ProposalsRegistrationEnded (2)
      expect(await voting.workflowStatus()).to.equal(2);
    });

    it("should revert ending proposals registration if not in correct state", async function () {
      await expect(voting.endProposalsRegistration()).to.be.revertedWith(
        "L'enregistrement des propositions n'est pas en cours."
      );
    });
  });

  describe("Voting Session", function () {
    beforeEach(async function () {
      // Setup: Register voters, start proposals, register proposals, then end proposals registration.
      await voting.registerVoter(addr1.address);
      await voting.registerVoter(addr2.address);
      await voting.startProposalsRegistration();
      await voting.connect(addr1).registerProposal("Proposal 1");
      await voting.connect(addr2).registerProposal("Proposal 2");
      await voting.endProposalsRegistration();
    });

    it("should allow the owner to start the voting session", async function () {
      await expect(voting.startVotingSession())
        .to.emit(voting, "WorkflowStatusChange")
        .withArgs(2, 3); // From ProposalsRegistrationEnded (2) to VotingSessionStarted (3)
      expect(await voting.workflowStatus()).to.equal(3);
    });

    it("should revert if startVotingSession is called when proposals registration not ended", async function () {
      // Deploy fresh instance up to proposals registration but not ending it.
      voting = await Voting.deploy();
      await voting.waitForDeployment();
      await voting.registerVoter(addr1.address);
      await voting.startProposalsRegistration();
      await voting.connect(addr1).registerProposal("Proposal 1");
      await expect(voting.startVotingSession()).to.be.revertedWith(
        "Les propositions ne sont pas encore enregistrees."
      );
    });

    it("should revert if vote is called when voting session is not active", async function () {
      // In this suite, the state is ProposalsRegistrationEnded (state 2).
      // Use a voter that's already registered (addr1).
      await expect(voting.connect(addr1).vote(0)).to.be.revertedWith("La session de vote n'est pas active.");
    });

    it("should allow a registered voter to vote", async function () {
      await voting.startVotingSession();
      await expect(voting.connect(addr1).vote(0))
        .to.emit(voting, "Voted")
        .withArgs(addr1.address, 0);
      const voter = await voting.voters(addr1.address);
      expect(voter.hasVoted).to.equal(true);
      expect(voter.votedProposalId).to.equal(0);
      const proposal = await voting.proposals(0);
      expect(proposal.voteCount).to.equal(1);
    });

    it("should revert if voter votes twice", async function () {
      await voting.startVotingSession();
      await voting.connect(addr1).vote(0);
      await expect(voting.connect(addr1).vote(1)).to.be.revertedWith("Vous avez deja vote.");
    });

    it("should revert if unregistered voter tries to vote", async function () {
      await voting.startVotingSession();
      await expect(voting.connect(addr3).vote(0)).to.be.revertedWith(
        "Vous n'etes pas enregistre en tant qu'electeur."
      );
    });

    it("should revert if voter votes for an invalid proposal", async function () {
      await voting.startVotingSession();
      await expect(voting.connect(addr1).vote(5)).to.be.revertedWith("La proposition n'existe pas.");
    });

    it("should allow the owner to end the voting session", async function () {
      await voting.startVotingSession();
      await expect(voting.endVotingSession())
        .to.emit(voting, "WorkflowStatusChange")
        .withArgs(3, 4); // From VotingSessionStarted (3) to VotingSessionEnded (4)
      expect(await voting.workflowStatus()).to.equal(4);
    });

    it("should revert ending voting session if not in correct state", async function () {
      await expect(voting.endVotingSession()).to.be.revertedWith(
        "La session de vote n'est pas en cours."
      );
    });
  });

  describe("Vote Tallying and Winner", function () {
    beforeEach(async function () {
      // Setup: Register voters, proposals, and simulate votes.
      await voting.registerVoter(addr1.address);
      await voting.registerVoter(addr2.address);
      await voting.registerVoter(addr3.address);
      await voting.startProposalsRegistration();
      await voting.connect(addr1).registerProposal("Proposal 1");
      await voting.connect(addr2).registerProposal("Proposal 2");
      await voting.endProposalsRegistration();
      await voting.startVotingSession();
      // Cast votes: addr1 and addr3 vote for proposal 0, addr2 votes for proposal 1.
      await voting.connect(addr1).vote(0);
      await voting.connect(addr2).vote(1);
      await voting.connect(addr3).vote(0);
      await voting.endVotingSession();
    });

    it("should tally votes and set the winning proposal", async function () {
      await expect(voting.tallyVotes())
        .to.emit(voting, "WorkflowStatusChange")
        .withArgs(4, 5); // From VotingSessionEnded (4) to VotesTallied (5)
      expect(await voting.workflowStatus()).to.equal(5);
      expect(await voting.winningProposalId()).to.equal(0);
    });

    it("should revert tallying votes if voting session not ended", async function () {
      // Deploy a fresh instance and set it up only until voting session.
      voting = await Voting.deploy();
      await voting.waitForDeployment();
      await voting.registerVoter(addr1.address);
      await voting.startProposalsRegistration();
      await voting.connect(addr1).registerProposal("Proposal 1");
      await voting.endProposalsRegistration();
      await voting.startVotingSession();
      await expect(voting.tallyVotes()).to.be.revertedWith(
        "La session de vote doit etre terminee."
      );
    });

    it("should return the winning proposal using getWinner", async function () {
      await voting.tallyVotes();
      const winner = await voting.getWinner();
      expect(winner.description).to.equal("Proposal 1");
      expect(winner.voteCount).to.equal(2);
    });

    it("should revert getWinner if votes not tallied", async function () {
      await expect(voting.getWinner()).to.be.revertedWith(
        "Les votes n'ont pas encore ete comptabilises."
      );
    });

    it("should tally votes when no proposals were registered and then revert on getWinner", async function () {
      // Deploy a fresh instance where no proposals are added.
      voting = await Voting.deploy();
      await voting.waitForDeployment();
      await voting.registerVoter(addr1.address);
      await voting.startProposalsRegistration();
      // End proposals registration without any proposals.
      await voting.endProposalsRegistration();
      await voting.startVotingSession();
      await voting.endVotingSession();
      await expect(voting.tallyVotes())
        .to.emit(voting, "WorkflowStatusChange")
        .withArgs(4, 5);
      // Since proposals array is empty, getWinner should revert.
      await expect(voting.getWinner()).to.be.reverted;
    });
  });
});
