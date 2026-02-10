/**
 * Secure Voting Machine with Blockchain Ledger
 * JavaScript port that mirrors the Verilog FSM + hash chain logic exactly
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

// Constants matching the Verilog module
const GENESIS_HASH = 0xDEADBEEF >>> 0;
const MIX_CONSTANT = 0x9E3779B9 >>> 0;

/**
 * Compute hash chain step — mirrors the Verilog combinational logic:
 *   block_data = {voter_id[3:0], vote_choice[1:0], block_count[7:0]}
 *   step1 = prev_hash XOR (block_data << 7)
 *   step2 = step1 XOR (step1 >>> 13)
 *   step3 = step2 + MIX_CONSTANT
 *   step4 = step3 XOR (step3 >>> 16)
 */
function computeNextHash(prevHash, voterId, voteChoice, blockCount) {
    // Pack block data exactly as in Verilog: {voter_id, vote_choice, block_count}
    const blockData = ((voterId & 0xF) << 10) | ((voteChoice & 0x3) << 8) | (blockCount & 0xFF);

    let h = (prevHash ^ (blockData << 7)) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = (h + MIX_CONSTANT) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h;
}

class SecureVotingMachine {
    constructor() {
        this.reset();
    }

    reset() {
        this.state = States.RESET;
        this.countA = 0;
        this.countB = 0;
        this.countC = 0;
        this.voterStatus = new Set();
        this.votingEnabled = false;
        this.busy = false;
        this.tieFlag = false;
        this.winner = null;
        this.voteChoice = null;
        this.pendingVote = null;

        // Blockchain ledger
        this.ledgerHash = GENESIS_HASH;
        this.blockCount = 0;
        this.blocks = []; // Full block history for UI display

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

        // Map candidate letter to 2-bit code matching Verilog
        const candidateMap = { 'A': 0b00, 'B': 0b01, 'C': 0b10 };
        const voteChoice = candidateMap[candidate];

        // Transition to VOTE state
        this.state = States.VOTE;
        this.busy = true;
        this.voteChoice = candidate;

        // Mark voter as having voted
        this.voterStatus.add(voterId);

        // Increment the appropriate counter
        switch (candidate) {
            case 'A': this.countA++; break;
            case 'B': this.countB++; break;
            case 'C': this.countC++; break;
        }

        // Blockchain: compute next hash (mirrors Verilog's VOTE state block)
        const prevHash = this.ledgerHash;
        const newHash = computeNextHash(prevHash, voterId, voteChoice, this.blockCount);

        // Record the block
        this.blocks.push({
            index: this.blockCount,
            voterId: voterId,
            candidate: candidate,
            prevHash: prevHash,
            hash: newHash,
            timestamp: Date.now()
        });

        this.ledgerHash = newHash;
        this.blockCount++;

        // Transition through LOCK and back to IDLE
        this.state = States.LOCK;
        this.busy = false;
        this.state = States.IDLE;

        return { success: true, block: this.blocks[this.blocks.length - 1] };
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

    /**
     * Verify the entire chain from genesis.
     * Re-computes every hash from scratch and checks if the final hash matches.
     * Returns { valid: boolean, mismatchAtBlock: number|null }
     */
    verifyChain() {
        let currentHash = GENESIS_HASH;
        const candidateMap = { 'A': 0b00, 'B': 0b01, 'C': 0b10 };

        for (let i = 0; i < this.blocks.length; i++) {
            const block = this.blocks[i];
            const expected = computeNextHash(currentHash, block.voterId, candidateMap[block.candidate], i);
            if (expected !== block.hash) {
                return { valid: false, mismatchAtBlock: i };
            }
            currentHash = expected;
        }

        if (this.blocks.length > 0 && currentHash !== this.ledgerHash) {
            return { valid: false, mismatchAtBlock: this.blocks.length - 1 };
        }

        return { valid: true, mismatchAtBlock: null };
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
            votedIds: Array.from(this.voterStatus),
            ledgerHash: this.ledgerHash,
            blockCount: this.blockCount,
            blocks: this.blocks
        };
    }
}

// Export for use in HTML
window.SecureVotingMachine = SecureVotingMachine;
window.States = States;
window.GENESIS_HASH = GENESIS_HASH;
window.computeNextHash = computeNextHash;
