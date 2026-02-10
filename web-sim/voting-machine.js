/**
 * Secure Voting Machine - JavaScript State Machine
 * Direct port of the Verilog FSM logic
 */

const States = {
    RESET: 'RESET',
    AUTH: 'AUTH',
    IDLE: 'IDLE',
    VOTE: 'VOTE',
    LOCK: 'LOCK',
    RESULT: 'RESULT'
};

const PASSWORD = 0b1010; // Binary 1010

class SecureVotingMachine {
    constructor() {
        this.reset();
    }

    reset() {
        this.state = States.RESET;
        this.countA = 0;
        this.countB = 0;
        this.countC = 0;
        this.voterStatus = new Set(); // Track which voter IDs have voted
        this.votingEnabled = false;
        this.busy = false;
        this.tieFlag = false;
        this.winner = null;
        this.voteChoice = null;
        this.pendingVote = null;

        // Transition to AUTH after reset
        this.state = States.AUTH;
    }

    // Admin authentication
    authenticate(password) {
        if (this.state !== States.AUTH) return false;

        if (password === PASSWORD) {
            this.votingEnabled = true;
            this.state = States.IDLE;
            return true;
        }
        return false;
    }

    // Check if voter can vote
    canVote(voterId) {
        return this.state === States.IDLE &&
            this.votingEnabled &&
            !this.voterStatus.has(voterId);
    }

    // Cast a vote
    vote(voterId, candidate) {
        if (!this.canVote(voterId)) {
            return { success: false, reason: this.getVoteBlockReason(voterId) };
        }

        // Transition to VOTE state
        this.state = States.VOTE;
        this.busy = true;
        this.voteChoice = candidate;

        // Mark voter as having voted
        this.voterStatus.add(voterId);

        // Increment the appropriate counter
        switch (candidate) {
            case 'A':
                this.countA++;
                break;
            case 'B':
                this.countB++;
                break;
            case 'C':
                this.countC++;
                break;
        }

        // Transition through LOCK and back to IDLE
        this.state = States.LOCK;
        this.busy = false;

        // Auto-transition back to IDLE (simulating vote button release)
        this.state = States.IDLE;

        return { success: true };
    }

    getVoteBlockReason(voterId) {
        if (this.state === States.RESULT) return 'Voting has ended';
        if (this.state === States.AUTH) return 'Admin not authenticated';
        if (!this.votingEnabled) return 'Voting is not enabled';
        if (this.voterStatus.has(voterId)) return 'This voter has already voted';
        return 'Unknown error';
    }

    // Enable result mode
    enableResultMode() {
        if (this.state === States.IDLE || this.state === States.AUTH) {
            this.state = States.RESULT;
            this.votingEnabled = false;
            this.calculateWinner();
            return true;
        }
        return false;
    }

    // Calculate winner (mirrors Verilog logic)
    calculateWinner() {
        if (this.state !== States.RESULT) {
            this.winner = null;
            this.tieFlag = false;
            return;
        }

        if (this.countA >= this.countB && this.countA >= this.countC) {
            this.winner = 'A';
            this.tieFlag = (this.countA === this.countB || this.countA === this.countC);
        } else if (this.countB >= this.countA && this.countB >= this.countC) {
            this.winner = 'B';
            this.tieFlag = (this.countB === this.countA || this.countB === this.countC);
        } else {
            this.winner = 'C';
            this.tieFlag = false;
        }
    }

    // Get current state for UI
    getState() {
        return {
            state: this.state,
            countA: this.countA,
            countB: this.countB,
            countC: this.countC,
            votingEnabled: this.votingEnabled,
            busy: this.busy,
            winner: this.winner,
            tieFlag: this.tieFlag,
            totalVotes: this.voterStatus.size,
            votedIds: Array.from(this.voterStatus)
        };
    }
}

// Export for use in HTML
window.SecureVotingMachine = SecureVotingMachine;
window.States = States;
