module secure_voting_machine (
    input clk,
    input reset,

    input [3:0] admin_password,
    input enable_admin,
    input result_mode,

    input [3:0] voter_id,
    input vote_a,
    input vote_b,
    input vote_c,

    output reg [7:0] count_a,
    output reg [7:0] count_b,
    output reg [7:0] count_c,
    output reg [1:0] winner,
    output reg voting_enabled,
    output reg busy,
    output reg tie_flag,

    // Blockchain ledger outputs
    output reg [31:0] ledger_hash,
    output reg [7:0]  block_count
);

    parameter PASSWORD = 4'b1010;

    // FSM States
    parameter RESET_S = 3'b000,
              AUTH    = 3'b001,
              IDLE    = 3'b010,
              VOTE    = 3'b011,
              LOCK    = 3'b100,
              RESULT  = 3'b101;

    reg [2:0] state, next_state;
    reg auth_ok;
    reg [15:0] voter_status;
    reg [1:0] vote_choice;

    // Genesis hash - initial seed for the chain
    parameter GENESIS_HASH = 32'hDEAD_BEEF;
    // Mixing constant (a prime-derived value for diffusion)
    parameter MIX_CONSTANT = 32'h9E3779B9;

    // Internal wire for computing next hash
    reg [31:0] next_hash;

    // Hash mixing function:
    //   step1 = prev_hash XOR (block_data << 7)
    //   step2 = step1 XOR (step1 >> 13)
    //   step3 = step2 + MIX_CONSTANT
    //   step4 = step3 XOR (step3 >> 16)
    // block_data = {voter_id, vote_choice, block_count}
    always @(*) begin
        // Pack the vote transaction into a 14-bit "block data" field
        //   [13:10] = voter_id
        //   [9:8]   = vote_choice
        //   [7:0]   = block_count
        next_hash = ledger_hash ^ ({18'b0, voter_id, vote_choice, block_count} << 7);
        next_hash = next_hash ^ (next_hash >> 13);
        next_hash = next_hash + MIX_CONSTANT;
        next_hash = next_hash ^ (next_hash >> 16);
    end

    // FSM state register
    always @(posedge clk or posedge reset) begin
        if (reset)
            state <= RESET_S;
        else
            state <= next_state;
    end

    // FSM next-state logic
    always @(*) begin
        case (state)
            RESET_S:
                next_state = AUTH;

            AUTH:
                if (enable_admin && admin_password == PASSWORD)
                    next_state = IDLE;
                else
                    next_state = AUTH;

            IDLE:
                if (result_mode)
                    next_state = RESULT;
                else if (voting_enabled && (vote_a || vote_b || vote_c) && !voter_status[voter_id])
                    next_state = VOTE;
                else
                    next_state = IDLE;

            VOTE:
                next_state = LOCK;

            LOCK:
                if (!vote_a && !vote_b && !vote_c)
                    next_state = IDLE;
                else
                    next_state = LOCK;

            RESULT:
                next_state = RESULT;

            default:
                next_state = RESET_S;
        endcase
    end

    // Output and control logic
    always @(posedge clk or posedge reset) begin
        if (reset) begin
            count_a <= 0;
            count_b <= 0;
            count_c <= 0;
            voter_status <= 0;
            voting_enabled <= 0;
            busy <= 0;
            ledger_hash <= GENESIS_HASH;
            block_count <= 0;
        end else begin
            case (state)
                AUTH: begin
                    if (admin_password == PASSWORD)
                        voting_enabled <= 1;
                end

                IDLE: begin
                    busy <= 0;
                    if (next_state == VOTE) begin
                        if (vote_a)
                            vote_choice <= 2'b00;
                        else if (vote_b)
                            vote_choice <= 2'b01;
                        else if (vote_c)
                            vote_choice <= 2'b10;
                    end
                end

                VOTE: begin
                    busy <= 1;
                    voter_status[voter_id] <= 1;

                    if (vote_choice == 2'b00)
                        count_a <= count_a + 1;
                    else if (vote_choice == 2'b01)
                        count_b <= count_b + 1;
                    else if (vote_choice == 2'b10)
                        count_c <= count_c + 1;

                    // Blockchain: commit the new block
                    ledger_hash <= next_hash;
                    block_count <= block_count + 1;
                end

                LOCK: begin
                    busy <= 0;
                end

                RESULT: begin
                    voting_enabled <= 0;
                end
            endcase
        end
    end

    // Winner detection with tie-breaker logic
    always @(*) begin
        if (state == RESULT) begin
            if (count_a >= count_b && count_a >= count_c) begin
                winner = 2'b00;
                tie_flag = (count_a == count_b || count_a == count_c);
            end else if (count_b >= count_a && count_b >= count_c) begin
                winner = 2'b01;
                tie_flag = (count_b == count_a || count_b == count_c);
            end else begin
                winner = 2'b10;
                tie_flag = 0;
            end
        end else begin
            winner = 2'b11;
            tie_flag = 0;
        end
    end

endmodule