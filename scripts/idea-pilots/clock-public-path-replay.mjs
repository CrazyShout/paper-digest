import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = resolve(dirname(SCRIPT_PATH), "../..");

export const SOURCE_AUDIT_PATH =
  "content/idea-audits/cooperative-autonomous-driving-clock-public-path-audit-v4.json";
export const OUTPUT_PATH =
  "content/idea-audits/cooperative-autonomous-driving-clock-public-path-replay-v5.json";

const EXPECTED_SOURCE_AUDIT_SHA256 =
  "98da4230981ce593b6081ffebc8428ee4640c19845baf207a7923a43d69eb694";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const SOURCE_CONTRACTS = deepFreeze([
  {
    caseId: "POS-01-AUTOWARE-VTL",
    repository: "autowarefoundation/autoware_universe",
    root: "/private/tmp/clock-audit-autoware",
    expectedCommit: "09df2ebfa09f425b7f42d163423816ec572b87c8",
    files: [
      {
        path: "planning/behavior_velocity_planner/autoware_behavior_velocity_virtual_traffic_light_module/config/virtual_traffic_light.param.yaml",
        expectedSha256:
          "389bd5080e130805c4cb75a2f9859b8509f243e498dfeef39ffb9f7fe7ef48c4",
        snippets: [
          {
            id: "autoware-configured-threshold",
            lines: [1, 8],
            expectedSha256:
              "961353c7e826a5922031c39d6a3318717baad7f088c3467e3a3984ee3e7ac4d9"
          }
        ]
      },
      {
        path: "planning/behavior_velocity_planner/autoware_behavior_velocity_virtual_traffic_light_module/src/manager.cpp",
        expectedSha256:
          "5a97a5331b7e433a9a5736d84a348be7e07f40b63d65fe5188e369ab828549c2",
        snippets: [
          {
            id: "autoware-threshold-binding",
            lines: [45, 55],
            expectedSha256:
              "4168b4f7b051bf6df6902f96c46cb568201c98c3eaf44609e2d4ece5b1d8f3dc"
          }
        ]
      },
      {
        path: "planning/behavior_velocity_planner/autoware_behavior_velocity_virtual_traffic_light_module/src/scene.cpp",
        expectedSha256:
          "5ac459db0f8143b15ed827973ed057fad2d4ca7af6e7bdce29b85b09f9c6fc32",
        snippets: [
          {
            id: "autoware-incoming-state-store",
            lines: [587, 624],
            expectedSha256:
              "e94d85ac64de0e82f5b3b8dc8e7c5a8283e83135f1f7ae000d07f093a52256ac"
          },
          {
            id: "autoware-timeout-expression",
            lines: [459, 468],
            expectedSha256:
              "7967c8109581dde6373086e0e82ccd50c6582121149a2acb3e6303b12fa21f9e"
          },
          {
            id: "autoware-before-stop-line-branch",
            lines: [269, 280],
            expectedSha256:
              "47624d0d8c9f451de85d0727eaf5e41d1ebb5e1a102eb08f949b57e8e773ce93"
          },
          {
            id: "autoware-after-stop-line-branch",
            lines: [288, 299],
            expectedSha256:
              "51f4b4044c87f383793f1b0d5407a91c726cd002477184b1dfbc70bd17e2f5df"
          }
        ]
      }
    ]
  },
  {
    caseId: "POS-02-CARMA-GNSS",
    repository: "usdot-fhwa-stol/carma-platform",
    root: "/private/tmp/clock-audit-carma-platform",
    expectedCommit: "1c774df099ce23e77394758969bf86b0e5f40863",
    files: [
      {
        path: "localization_manager/include/localization_manager/LocalizationManagerConfig.hpp",
        expectedSha256:
          "b12df4e201fff592f9398801bd51f15e90ec312eda916b5cf6ef6982fab40a3e",
        snippets: [
          {
            id: "carma-threshold-default",
            lines: [44, 45],
            expectedSha256:
              "cc194deeef19917b9b983ca1e9563e9f3d414c74131f86233040e367c3330df7"
          }
        ]
      },
      {
        path: "localization_manager/src/localization_manager_node.cpp",
        expectedSha256:
          "600397ae38b9562f1a5dcb20e2c1a4a87bd89bbe012d783472528e11869a91f1",
        snippets: [
          {
            id: "carma-threshold-declaration",
            lines: [35, 41],
            expectedSha256:
              "f1689afada65d5721825650f3b1d64068d56190a572bdec2a9b859e4925fb1e3"
          },
          {
            id: "carma-threshold-load",
            lines: [53, 62],
            expectedSha256:
              "096f5deefc8c51cd0ee554c05bb049a585549f43d53ab1950e1d0f3d0ffdd385"
          },
          {
            id: "carma-gnss-subscription",
            lines: [81, 85],
            expectedSha256:
              "fa147a331e164d433a8a090bd5da6ddc18b80b06baab848229eecceffa94bbf2"
          }
        ]
      },
      {
        path: "localization_manager/src/LocalizationManager.cpp",
        expectedSha256:
          "ee5d41fa49cffffe773c9f216d0675ea50c68dd48d22f4b6c03db8aaf0981bc2",
        snippets: [
          {
            id: "carma-local-clock-type-binding",
            lines: [26, 39],
            expectedSha256:
              "fbf9658858dbe644306f8a024f4cae8ad27fc2d112ad6e2171d47b943964715e"
          },
          {
            id: "carma-incoming-gnss-store",
            lines: [143, 150],
            expectedSha256:
              "f2b10efd68e332def07e20ab67478c4827b0c4b46108185c0e7eb988362cab25"
          },
          {
            id: "carma-timeout-expression-and-signal",
            lines: [263, 287],
            expectedSha256:
              "4ae54a3550fb5f501875f7c1cb9e988b8bbd616ba8154e4810dd3a328c2e7736"
          }
        ]
      },
      {
        path: "localization_manager/src/LocalizationTransitionTable.cpp",
        expectedSha256:
          "9dc296dfdfb4ebef3f2b085293480d87b11cfb7d3481193b5f0a247cb8da7f11",
        snippets: [
          {
            id: "carma-timeout-state-branch",
            lines: [169, 193],
            expectedSha256:
              "b783e805bef73ff76b82d825277ef2b4dca4d4c1596970d17a4b8a90c8b0bf75"
          }
        ]
      },
      {
        path: "approaching_emergency_vehicle_plugin/src/approaching_emergency_vehicle_plugin_node.cpp",
        expectedSha256:
          "571ac1045da676411a5cf8245922e6e83056a1b59f794a5f3465ee70ca28f6e0",
        snippets: [
          {
            id: "carma-same-clock-timeout-control",
            lines: [235, 245],
            expectedSha256:
              "b89edba7f587f2591f4f36b0bd1bf6c42818866275e886f29dc8b26b85a17283"
          },
          {
            id: "carma-same-clock-receipt-store",
            lines: [870, 877],
            expectedSha256:
              "d92f10dcdb42a973e96ff347e2f3e71c7c3e46c3e8a950465159b8c34fd6ad15"
          }
        ]
      }
    ]
  }
]);

export const CLAIM_BOUNDARY = deepFreeze({
  researchQuestion:
    "Whether the visible operands of each frozen source expression are sufficient to identify deadline truth when their clock relation is not supplied to that expression.",
  supported: [
    "At the two fixed commits, the recorded snippets, hashes, operands, thresholds, comparators, and conditional downstream branches match the declared source contracts.",
    "For each replayed expression, two monotone unit-rate clock mappings preserve the same visible now, stamp, threshold, pair identity, and source-expression timeout while producing opposite reference-clock deadline truths.",
    "A same-clock source control is invariant to a common reference-clock offset, a local receipt-time redesign is invariant to the remote mapping for time-since-receipt semantics, and a bounded mapping that straddles the threshold returns uncertain."
  ],
  notSupported: [
    "No claim is made that clocks in a real deployment are different, unsynchronized, misconfigured, or outside any error bound.",
    "No product-safety, field-behavior, vulnerability, incident, frequency, prevalence, or deployment-risk conclusion is made.",
    "The replay does not establish reachability of the surrounding runtime state, end-to-end actuation, or a safety consequence.",
    "The receipt-time redesign measures time since local receipt rather than source-event age, and the illustrative bounded-provenance intervals are not field-calibrated guarantees.",
    "No candidate, repository, implementation, product, or paper is scored."
  ]
});

export const LIMITATIONS = deepFreeze([
  "The upstream ROS 2 stacks are not built or executed; the adapters replay only the exact subtraction, unit conversion, comparator, and recorded conditional branch semantics.",
  "Synthetic affine mappings are constructive information-sufficiency witnesses, not observations of either repository's deployment clocks.",
  "The JavaScript adapters do not model rclcpp exception behavior, integer overflow, clock jumps, simulation-time activation, scheduling, transport, or callback interleavings.",
  "The Autoware and CARMA configured defaults are replay inputs, while either deployment may override parameters.",
  "The same-clock control verifies one frozen CARMA receipt-time path and is not a universal audit of same-clock implementations.",
  "The bounded-provenance control assumes declared mapping bounds are valid; this experiment does not estimate or validate such bounds.",
  "The downstream effects are source-level conditional branches only; no claim is made about their runtime frequency, reachability, severity, or field outcome."
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

export function sha256Json(value) {
  return sha256Text(JSON.stringify(canonicalize(value)));
}

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8"
  }).trimEnd();
}

function gitFile(root, commit, path) {
  return execFileSync(
    "git",
    ["-C", root, "show", `${commit}:${path}`],
    { encoding: "utf8" }
  );
}

function exactLineSlice(source, [start, end]) {
  invariant(
    Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start,
    `Invalid line interval ${start}-${end}`
  );
  const lines = source.split("\n");
  invariant(end <= lines.length, `Line interval ${start}-${end} exceeds source`);
  return `${lines.slice(start - 1, end).join("\n")}\n`;
}

function requireMatch(text, pattern, label, capture = 1) {
  const match = text.match(pattern);
  invariant(match, `Mechanical extraction failed for ${label}`);
  return match[capture];
}

function snippetsById(sourceVerification) {
  return new Map(
    sourceVerification.flatMap((repository) =>
      repository.files.flatMap((file) =>
        file.snippets.map((snippet) => [snippet.id, snippet])
      )
    )
  );
}

export function verifySourceAudit() {
  const absolutePath = resolve(REPOSITORY_ROOT, SOURCE_AUDIT_PATH);
  const text = readFileSync(absolutePath, "utf8");
  const sha256 = sha256Text(text);
  invariant(
    sha256 === EXPECTED_SOURCE_AUDIT_SHA256,
    `Source audit SHA-256 mismatch: ${sha256}`
  );
  const audit = JSON.parse(text);
  const strictPositiveById = new Map(
    audit.positiveCases.map((entry) => [entry.id, entry])
  );
  for (const contract of SOURCE_CONTRACTS) {
    const sourceCase = strictPositiveById.get(contract.caseId);
    invariant(sourceCase, `Missing strict positive ${contract.caseId}`);
    invariant(
      sourceCase.fixedCommit === contract.expectedCommit,
      `Fixed commit mismatch in v4 for ${contract.caseId}`
    );
  }
  invariant(
    strictPositiveById.size === SOURCE_CONTRACTS.length,
    "The v4 strict-positive set changed"
  );
  return {
    path: SOURCE_AUDIT_PATH,
    sha256,
    strictPositiveIds: [...strictPositiveById.keys()]
  };
}

export function verifyFrozenSources() {
  return SOURCE_CONTRACTS.map((contract) => {
    invariant(existsSync(contract.root), `Missing source root ${contract.root}`);
    const observedHead = git(contract.root, ["rev-parse", "HEAD"]);
    invariant(
      observedHead === contract.expectedCommit,
      `${contract.repository} HEAD is ${observedHead}, expected ${contract.expectedCommit}`
    );
    const worktreeStatus = git(contract.root, ["status", "--porcelain"]);
    invariant(
      worktreeStatus === "",
      `${contract.repository} worktree is not clean`
    );

    const files = contract.files.map((fileContract) => {
      const source = gitFile(
        contract.root,
        contract.expectedCommit,
        fileContract.path
      );
      const sourceSha256 = sha256Text(source);
      invariant(
        sourceSha256 === fileContract.expectedSha256,
        `${fileContract.path} SHA-256 mismatch: ${sourceSha256}`
      );
      const worktreeSource = readFileSync(
        resolve(contract.root, fileContract.path),
        "utf8"
      );
      invariant(
        sha256Text(worktreeSource) === sourceSha256,
        `${fileContract.path} worktree content differs from the fixed commit`
      );

      return {
        path: fileContract.path,
        gitBlobOid: git(contract.root, [
          "rev-parse",
          `${contract.expectedCommit}:${fileContract.path}`
        ]),
        sourceSha256,
        worktreeMatchesFixedCommit: true,
        snippets: fileContract.snippets.map((snippetContract) => {
          const text = exactLineSlice(source, snippetContract.lines);
          const sha256 = sha256Text(text);
          invariant(
            sha256 === snippetContract.expectedSha256,
            `${snippetContract.id} SHA-256 mismatch: ${sha256}`
          );
          return {
            id: snippetContract.id,
            lines: snippetContract.lines,
            sha256,
            text
          };
        })
      };
    });

    return {
      caseId: contract.caseId,
      repository: contract.repository,
      readOnlyRoot: contract.root,
      expectedCommit: contract.expectedCommit,
      observedHead,
      commitMatches: true,
      worktreeClean: true,
      extractionRef: contract.expectedCommit,
      files
    };
  });
}

export function mechanicallyExtractSemantics(sourceVerification) {
  const snippets = snippetsById(sourceVerification);
  const text = (id) => {
    const snippet = snippets.get(id);
    invariant(snippet, `Missing verified snippet ${id}`);
    return snippet.text;
  };

  const autowareThresholdSeconds = Number(
    requireMatch(
      text("autoware-configured-threshold"),
      /^\s*max_delay_sec:\s*([0-9.]+)\s*$/m,
      "Autoware configured max_delay_sec"
    )
  );
  invariant(
    text("autoware-threshold-binding").includes(
      'p.max_delay_sec = get_or_declare_parameter<double>(node, ns + ".max_delay_sec");'
    ),
    "Autoware threshold binding changed"
  );
  const autowareExpression = text("autoware-timeout-expression");
  const autowareNow = requireMatch(
    autowareExpression,
    /const auto delay = \((clock_->now\(\)) - rclcpp::Time\((state\.stamp)\)\)\.seconds\(\);/,
    "Autoware local now"
  );
  const autowareStamp = requireMatch(
    autowareExpression,
    /const auto delay = \((clock_->now\(\)) - rclcpp::Time\((state\.stamp)\)\)\.seconds\(\);/,
    "Autoware incoming stamp",
    2
  );
  const autowareComparator = requireMatch(
    autowareExpression,
    /if \(delay (>) planner_param_\.max_delay_sec\)/,
    "Autoware comparator"
  );
  const autowareStore = text("autoware-incoming-state-store");
  invariant(
    /for \(const auto & state : virtual_traffic_light_states->states\)/.test(
      autowareStore
    ) &&
      /state\.id != map_data_\.instrument_id/.test(autowareStore) &&
      /virtual_traffic_light_state_ = state;/.test(autowareStore),
    "Autoware incoming-state selection/store changed"
  );
  const autowareBeforeBranch = text("autoware-before-stop-line-branch");
  const autowareAfterBranch = text("autoware-after-stop-line-branch");
  invariant(
    /isStateTimeout\(\*virtual_traffic_light_state_\)/.test(
      autowareBeforeBranch
    ) && /insertStopVelocityAtStopLine/.test(autowareBeforeBranch),
    "Autoware before-stop-line timeout branch changed"
  );
  invariant(
    /check_timeout_after_stop_line && isStateTimeout\(\*virtual_traffic_light_state_\)/.test(
      autowareAfterBranch
    ) && /insertStopVelocityAtStopLine/.test(autowareAfterBranch),
    "Autoware after-stop-line timeout branch changed"
  );

  const carmaDefaultMilliseconds = Number(
    requireMatch(
      text("carma-threshold-default"),
      /int gnss_data_timeout = (\d+);/,
      "CARMA default GNSS timeout"
    )
  );
  invariant(
    /declare_parameter<int>\("gnss_data_timeout", config_\.gnss_data_timeout\)/.test(
      text("carma-threshold-declaration")
    ) &&
      /get_parameter<int>\("gnss_data_timeout", config_\.gnss_data_timeout\)/.test(
        text("carma-threshold-load")
      ),
    "CARMA threshold parameter binding changed"
  );
  invariant(
    /create_subscription<geometry_msgs::msg::PoseStamped>\("gnss_pose"/.test(
      text("carma-gnss-subscription")
    ) &&
      /LocalizationManager::gnssPoseCallback/.test(
        text("carma-gnss-subscription")
      ) &&
      /last_raw_gnss_value_ = \*msg;/.test(
        text("carma-incoming-gnss-store")
      ),
    "CARMA GNSS subscription/store changed"
  );
  const carmaClockBinding = text("carma-local-clock-type-binding");
  invariant(
    /timer_clock_type_ = timer_factory_->now\(\)\.get_clock_type\(\);/.test(
      carmaClockBinding
    ),
    "CARMA local timer clock binding changed"
  );
  const carmaExpression = text("carma-timeout-expression-and-signal");
  const carmaNow = requireMatch(
    carmaExpression,
    /last_raw_gnss_value_ && (timer_factory_->now\(\)) - rclcpp::Time/,
    "CARMA local now"
  );
  const carmaStamp = requireMatch(
    carmaExpression,
    /rclcpp::Time\((last_raw_gnss_value_->header\.stamp), timer_clock_type_\)/,
    "CARMA incoming stamp"
  );
  const carmaComparator = requireMatch(
    carmaExpression,
    /timer_clock_type_\) (>) rclcpp::Duration::from_nanoseconds/,
    "CARMA comparator"
  );
  const carmaMultiplier = requireMatch(
    carmaExpression,
    /config_\.gnss_data_timeout \* (1e6)/,
    "CARMA millisecond-to-nanosecond multiplier"
  );
  invariant(
    /transition_table_\.signal\(LocalizationSignal::GNSS_DATA_TIMEOUT\);/.test(
      carmaExpression
    ),
    "CARMA timeout signal branch changed"
  );
  const carmaStateBranch = text("carma-timeout-state-branch");
  invariant(
    /case LocalizationSignal::GNSS_DATA_TIMEOUT:/.test(carmaStateBranch) &&
      /throw std::runtime_error\("GNSS_DATA_TIMEOUT occurred while in DEGRADED_NO_LIDAR_FIX state\. Localization cannot recover"\);/.test(
        carmaStateBranch
      ),
    "CARMA downstream timeout state branch changed"
  );
  const sameClockStore = text("carma-same-clock-receipt-store");
  const sameClockTimeout = text("carma-same-clock-timeout-control");
  const sameClockStoredValue = requireMatch(
    sameClockStore,
    /tracked_erv_\.(latest_update_time) = this->now\(\);/,
    "CARMA same-clock receipt store"
  );
  const sameClockNow = requireMatch(
    sameClockTimeout,
    /\((this->get_clock\(\)->now\(\)) - tracked_erv_\.latest_update_time\)\.seconds\(\)/,
    "CARMA same-clock local now"
  );
  const sameClockComparator = requireMatch(
    sameClockTimeout,
    /seconds_since_prev_update (>=) config_\.timeout_duration/,
    "CARMA same-clock comparator"
  );

  return {
    autoware: {
      caseId: "POS-01-AUTOWARE-VTL",
      threshold: {
        symbol: "planner_param_.max_delay_sec",
        configuredValue: autowareThresholdSeconds,
        unit: "seconds",
        sourceSnippetIds: [
          "autoware-configured-threshold",
          "autoware-threshold-binding"
        ]
      },
      incomingStamp: {
        operand: autowareStamp,
        storage: "virtual_traffic_light_state_ = state",
        selection: "state.id == map_data_.instrument_id",
        sourceSnippetId: "autoware-incoming-state-store"
      },
      localNow: {
        operand: autowareNow,
        sourceSnippetId: "autoware-timeout-expression"
      },
      expression: {
        operation: "(clock_->now() - rclcpp::Time(state.stamp)).seconds()",
        comparator: autowareComparator,
        thresholdSymbol: "planner_param_.max_delay_sec",
        sourceSnippetId: "autoware-timeout-expression"
      },
      subsequentControlBranches: [
        {
          condition: "before stop line and isStateTimeout",
          action: "insertStopVelocityAtStopLine",
          sourceSnippetId: "autoware-before-stop-line-branch"
        },
        {
          condition:
            "check_timeout_after_stop_line and isStateTimeout",
          action:
            "insertStopVelocityAtStopLine and updateInfrastructureCommand",
          sourceSnippetId: "autoware-after-stop-line-branch"
        }
      ]
    },
    carma: {
      caseId: "POS-02-CARMA-GNSS",
      threshold: {
        symbol: "config_.gnss_data_timeout",
        configuredDefault: carmaDefaultMilliseconds,
        unit: "milliseconds",
        conversionToNanoseconds: Number(carmaMultiplier),
        sourceSnippetIds: [
          "carma-threshold-default",
          "carma-threshold-declaration",
          "carma-threshold-load"
        ]
      },
      incomingStamp: {
        operand: carmaStamp,
        subscription: "gnss_pose PoseStamped -> gnssPoseCallback",
        storage: "last_raw_gnss_value_ = *msg",
        clockTypeAppliedAtUse: "timer_clock_type_",
        sourceSnippetIds: [
          "carma-gnss-subscription",
          "carma-incoming-gnss-store",
          "carma-timeout-expression-and-signal"
        ]
      },
      localNow: {
        operand: carmaNow,
        clockTypeBinding:
          "timer_clock_type_ = timer_factory_->now().get_clock_type()",
        sourceSnippetIds: [
          "carma-local-clock-type-binding",
          "carma-timeout-expression-and-signal"
        ]
      },
      expression: {
        operation:
          "timer_factory_->now() - rclcpp::Time(last_raw_gnss_value_->header.stamp, timer_clock_type_)",
        comparator: carmaComparator,
        thresholdOperation:
          "rclcpp::Duration::from_nanoseconds(config_.gnss_data_timeout * 1e6)",
        sourceSnippetId: "carma-timeout-expression-and-signal"
      },
      subsequentControlBranches: [
        {
          condition: "timeout expression is true",
          action:
            "transition_table_.signal(LocalizationSignal::GNSS_DATA_TIMEOUT)",
          sourceSnippetId: "carma-timeout-expression-and-signal"
        },
        {
          condition:
            "GNSS_DATA_TIMEOUT while state is DEGRADED_NO_LIDAR_FIX",
          action: "throw runtime_error: Localization cannot recover",
          sourceSnippetId: "carma-timeout-state-branch"
        }
      ],
      sameClockControl: {
        storedValue: `tracked_erv_.${sameClockStoredValue}`,
        receiptClock: "this->now()",
        decisionClock: sameClockNow,
        comparator: sameClockComparator,
        thresholdSymbol: "config_.timeout_duration",
        sourceSnippetIds: [
          "carma-same-clock-receipt-store",
          "carma-same-clock-timeout-control"
        ]
      }
    }
  };
}

function bigint(value, label) {
  try {
    return BigInt(value);
  } catch {
    throw new TypeError(`${label} must be an integer nanosecond value`);
  }
}

function durationRecord(nanoseconds) {
  return {
    nanoseconds: nanoseconds.toString(),
    milliseconds: Number(nanoseconds) / 1e6,
    seconds: Number(nanoseconds) / 1e9
  };
}

export function replayAutowareTimeout({
  nowNanoseconds,
  stampNanoseconds,
  maxDelaySeconds
}) {
  const delayNanoseconds =
    bigint(nowNanoseconds, "nowNanoseconds") -
    bigint(stampNanoseconds, "stampNanoseconds");
  const delaySeconds = Number(delayNanoseconds) / 1e9;
  return {
    observedDelay: durationRecord(delayNanoseconds),
    threshold: {
      seconds: maxDelaySeconds,
      nanoseconds: Math.round(maxDelaySeconds * 1e9).toString()
    },
    comparator: ">",
    timeout: delaySeconds > maxDelaySeconds
  };
}

export function replayCarmaGnssTimeout({
  nowNanoseconds,
  stampNanoseconds,
  gnssDataTimeoutMilliseconds
}) {
  const delayNanoseconds =
    bigint(nowNanoseconds, "nowNanoseconds") -
    bigint(stampNanoseconds, "stampNanoseconds");
  const thresholdNanoseconds = BigInt(gnssDataTimeoutMilliseconds) * 1000000n;
  return {
    observedDelay: durationRecord(delayNanoseconds),
    threshold: {
      milliseconds: gnssDataTimeoutMilliseconds,
      nanoseconds: thresholdNanoseconds.toString()
    },
    comparator: ">",
    timeout: delayNanoseconds > thresholdNanoseconds
  };
}

export function replayCarmaSameClockTimeout({
  nowNanoseconds,
  latestUpdateNanoseconds,
  timeoutDurationSeconds
}) {
  const delayNanoseconds =
    bigint(nowNanoseconds, "nowNanoseconds") -
    bigint(latestUpdateNanoseconds, "latestUpdateNanoseconds");
  const delaySeconds = Number(delayNanoseconds) / 1e9;
  return {
    observedDelay: durationRecord(delayNanoseconds),
    threshold: {
      seconds: timeoutDurationSeconds,
      nanoseconds: Math.round(timeoutDurationSeconds * 1e9).toString()
    },
    comparator: ">=",
    timeout: delaySeconds >= timeoutDurationSeconds
  };
}

export function boundedProvenanceDecision({
  nowNanoseconds,
  stampNanoseconds,
  thresholdNanoseconds,
  localReferenceOffsetBoundsNanoseconds,
  sourceReferenceOffsetBoundsNanoseconds,
  domainBound,
  mappingValid
}) {
  if (!domainBound || !mappingValid) {
    return {
      verdict: "uncertain",
      reason: "clock-domain-unbound-or-mapping-invalid",
      identifiedAge: null
    };
  }
  const now = bigint(nowNanoseconds, "nowNanoseconds");
  const stamp = bigint(stampNanoseconds, "stampNanoseconds");
  const threshold = bigint(thresholdNanoseconds, "thresholdNanoseconds");
  const localLower = bigint(
    localReferenceOffsetBoundsNanoseconds[0],
    "localReferenceOffsetBoundsNanoseconds[0]"
  );
  const localUpper = bigint(
    localReferenceOffsetBoundsNanoseconds[1],
    "localReferenceOffsetBoundsNanoseconds[1]"
  );
  const sourceLower = bigint(
    sourceReferenceOffsetBoundsNanoseconds[0],
    "sourceReferenceOffsetBoundsNanoseconds[0]"
  );
  const sourceUpper = bigint(
    sourceReferenceOffsetBoundsNanoseconds[1],
    "sourceReferenceOffsetBoundsNanoseconds[1]"
  );
  invariant(localLower <= localUpper, "Invalid local offset bounds");
  invariant(sourceLower <= sourceUpper, "Invalid source offset bounds");
  const ageLower = now + localLower - (stamp + sourceUpper);
  const ageUpper = now + localUpper - (stamp + sourceLower);
  invariant(ageLower <= ageUpper, "Invalid identified age interval");

  let verdict = "uncertain";
  let reason = "identified-age-interval-crosses-strict-threshold";
  if (ageLower > threshold) {
    verdict = "timeout";
    reason = "entire-identified-age-interval-exceeds-threshold";
  } else if (ageUpper <= threshold) {
    verdict = "fresh";
    reason = "entire-identified-age-interval-is-at-or-below-threshold";
  }
  return {
    verdict,
    reason,
    comparator: ">",
    threshold: durationRecord(threshold),
    identifiedAge: {
      lower: durationRecord(ageLower),
      upper: durationRecord(ageUpper)
    }
  };
}

function visibleIdentity(record) {
  const sha256 = sha256Json(record);
  return {
    pairId: `${record.caseId.toLowerCase()}-${sha256.slice(0, 16)}`,
    visibleInputSha256: sha256
  };
}

function referenceTruth({
  nowNanoseconds,
  stampNanoseconds,
  thresholdNanoseconds,
  localOffsetNanoseconds,
  sourceOffsetNanoseconds,
  comparator = ">"
}) {
  const nowReference =
    bigint(nowNanoseconds, "nowNanoseconds") +
    bigint(localOffsetNanoseconds, "localOffsetNanoseconds");
  const stampReference =
    bigint(stampNanoseconds, "stampNanoseconds") +
    bigint(sourceOffsetNanoseconds, "sourceOffsetNanoseconds");
  const age = nowReference - stampReference;
  const threshold = bigint(thresholdNanoseconds, "thresholdNanoseconds");
  return {
    referenceNow: durationRecord(nowReference),
    referenceStamp: durationRecord(stampReference),
    referenceAge: durationRecord(age),
    comparator,
    timeout: comparator === ">=" ? age >= threshold : age > threshold
  };
}

function buildStrictPair({
  caseId,
  adapterId,
  nowNanoseconds,
  stampNanoseconds,
  thresholdNanoseconds,
  sourceOffsetsNanoseconds,
  runAdapter
}) {
  const visible = {
    caseId,
    adapterId,
    nowNanoseconds,
    stampNanoseconds,
    thresholdNanoseconds,
    comparator: ">"
  };
  const identity = visibleIdentity(visible);
  const expression = runAdapter();
  const worlds = sourceOffsetsNanoseconds.map((sourceOffset, index) => {
    const truth = referenceTruth({
      nowNanoseconds,
      stampNanoseconds,
      thresholdNanoseconds,
      localOffsetNanoseconds: "0",
      sourceOffsetNanoseconds: sourceOffset,
      comparator: ">"
    });
    return {
      worldId: `${identity.pairId}-world-${index + 1}`,
      pairId: identity.pairId,
      visibleInputSha256: identity.visibleInputSha256,
      clockMapping: {
        kind: "monotone-unit-rate-affine-to-reference",
        localClock: {
          rate: 1,
          offsetNanoseconds: "0"
        },
        sourceClock: {
          rate: 1,
          offsetNanoseconds: sourceOffset
        },
        monotone: true,
        invertible: true
      },
      sourceExpressionTimeout: expression.timeout,
      referenceDeadlineTruth: truth,
      relation:
        expression.timeout === truth.timeout
          ? "source-expression-matches-reference-truth"
          : "source-expression-diverges-from-reference-truth"
    };
  });
  const expressionOutcomes = new Set(
    worlds.map((world) => world.sourceExpressionTimeout)
  );
  const truthOutcomes = new Set(
    worlds.map((world) => world.referenceDeadlineTruth.timeout)
  );
  invariant(expressionOutcomes.size === 1, `${caseId} expression outcomes differ`);
  invariant(truthOutcomes.size === 2, `${caseId} reference truths do not differ`);
  invariant(
    worlds.every(
      (world) =>
        world.pairId === identity.pairId &&
        world.visibleInputSha256 === identity.visibleInputSha256
    ),
    `${caseId} pair identity changed across worlds`
  );
  return {
    ...identity,
    visibleInputs: visible,
    sourceEquivalentResult: expression,
    worlds,
    checks: {
      visibleInputsIdenticalAcrossWorlds: true,
      pairIdentityIdenticalAcrossWorlds: true,
      sourceExpressionTimeoutIdenticalAcrossWorlds: true,
      referenceDeadlineTruthOppositeAcrossWorlds: true
    }
  };
}

function buildSameClockControl() {
  const visible = {
    controlId: "CARMA-ERV-SAME-CLOCK",
    adapterId: "carma-erv-same-clock-seconds-greater-than-or-equal",
    nowNanoseconds: "20000000000",
    latestUpdateNanoseconds: "15000000000",
    thresholdNanoseconds: "5000000000",
    comparator: ">="
  };
  const identity = visibleIdentity({ caseId: visible.controlId, ...visible });
  const expression = replayCarmaSameClockTimeout({
    nowNanoseconds: visible.nowNanoseconds,
    latestUpdateNanoseconds: visible.latestUpdateNanoseconds,
    timeoutDurationSeconds: 5
  });
  const commonOffsets = ["-7000000000", "13000000000"];
  const worlds = commonOffsets.map((offset, index) => {
    const truth = referenceTruth({
      nowNanoseconds: visible.nowNanoseconds,
      stampNanoseconds: visible.latestUpdateNanoseconds,
      thresholdNanoseconds: visible.thresholdNanoseconds,
      localOffsetNanoseconds: offset,
      sourceOffsetNanoseconds: offset,
      comparator: ">="
    });
    return {
      worldId: `${identity.pairId}-world-${index + 1}`,
      pairId: identity.pairId,
      visibleInputSha256: identity.visibleInputSha256,
      commonReferenceOffsetNanoseconds: offset,
      sourceExpressionTimeout: expression.timeout,
      referenceDeadlineTruth: truth
    };
  });
  invariant(
    worlds.every(
      (world) =>
        world.sourceExpressionTimeout === true &&
        world.referenceDeadlineTruth.timeout === true
    ),
    "Same-clock control is not invariant"
  );
  return {
    ...identity,
    sourceEvidenceSnippetIds: [
      "carma-same-clock-receipt-store",
      "carma-same-clock-timeout-control"
    ],
    visibleInputs: visible,
    sourceEquivalentResult: expression,
    worlds,
    checks: {
      commonOffsetAppliedToBothOperands: true,
      sourceExpressionAndReferenceTruthInvariant: true,
      exactThresholdUsesGreaterThanOrEqual: true
    }
  };
}

function buildReceiptTimeRedesign(pair, runAdapter) {
  const now = bigint(pair.visibleInputs.nowNanoseconds, "nowNanoseconds");
  const threshold = bigint(
    pair.visibleInputs.thresholdNanoseconds,
    "thresholdNanoseconds"
  );
  const localReceipt = now - threshold / 2n;
  const result = runAdapter(localReceipt.toString());
  invariant(result.timeout === false, `${pair.pairId} receipt redesign timed out`);
  return {
    controlId: `${pair.pairId}-local-receipt-time`,
    basedOnPairId: pair.pairId,
    semanticTarget: "time-since-local-receipt",
    sourceEventAgeEstimated: false,
    localReceiptNanoseconds: localReceipt.toString(),
    remoteSourceStampUsedByDecision: false,
    sourceEquivalentComparatorAndUnitsRetained: true,
    result,
    worlds: pair.worlds.map((world) => ({
      sourceWorldId: world.worldId,
      remoteSourceOffsetNanoseconds:
        world.clockMapping.sourceClock.offsetNanoseconds,
      receiptTimeout: result.timeout
    })),
    checks: {
      invariantToRemoteClockMapping: true,
      reportsOnlyLocalReceiptFreshness: true
    }
  };
}

function buildBoundedControl(pair) {
  const sourceOffsets = pair.worlds.map((world) =>
    bigint(
      world.clockMapping.sourceClock.offsetNanoseconds,
      "sourceOffsetNanoseconds"
    )
  );
  const lower = sourceOffsets.reduce((a, b) => (a < b ? a : b));
  const upper = sourceOffsets.reduce((a, b) => (a > b ? a : b));
  const result = boundedProvenanceDecision({
    nowNanoseconds: pair.visibleInputs.nowNanoseconds,
    stampNanoseconds: pair.visibleInputs.stampNanoseconds,
    thresholdNanoseconds: pair.visibleInputs.thresholdNanoseconds,
    localReferenceOffsetBoundsNanoseconds: ["0", "0"],
    sourceReferenceOffsetBoundsNanoseconds: [
      lower.toString(),
      upper.toString()
    ],
    domainBound: true,
    mappingValid: true
  });
  invariant(result.verdict === "uncertain", `${pair.pairId} should be uncertain`);
  return {
    controlId: `${pair.pairId}-bounded-provenance`,
    basedOnPairId: pair.pairId,
    provenance: {
      sourceClockDomainId: `${pair.visibleInputs.caseId}-source-clock`,
      decisionClockDomainId: `${pair.visibleInputs.caseId}-decision-clock`,
      referenceClockDomainId: "replay-reference-clock",
      domainBound: true,
      mappingValid: true,
      localReferenceOffsetBoundsNanoseconds: ["0", "0"],
      sourceReferenceOffsetBoundsNanoseconds: [
        lower.toString(),
        upper.toString()
      ]
    },
    result,
    checks: {
      containsBothConstructedWorldTruths: true,
      identifiedAgeIntervalCrossesThreshold: true,
      verdictIsUncertain: true
    }
  };
}

export function buildReplayExperiment({
  autowareMaxDelaySeconds,
  carmaGnssTimeoutMilliseconds
}) {
  invariant(
    Number.isFinite(autowareMaxDelaySeconds) && autowareMaxDelaySeconds > 0,
    "Autoware threshold must be positive"
  );
  invariant(
    Number.isInteger(carmaGnssTimeoutMilliseconds) &&
      carmaGnssTimeoutMilliseconds > 0,
    "CARMA threshold must be a positive integer"
  );
  const autowareThresholdNanoseconds = BigInt(
    Math.round(autowareMaxDelaySeconds * 1e9)
  ).toString();
  const carmaThresholdNanoseconds = (
    BigInt(carmaGnssTimeoutMilliseconds) * 1000000n
  ).toString();

  const autowarePair = buildStrictPair({
    caseId: "POS-01-AUTOWARE-VTL",
    adapterId: "autoware-vtl-seconds-greater-than",
    nowNanoseconds: "100000000000",
    stampNanoseconds: "96000000000",
    thresholdNanoseconds: autowareThresholdNanoseconds,
    sourceOffsetsNanoseconds: ["0", "2000000000"],
    runAdapter: () =>
      replayAutowareTimeout({
        nowNanoseconds: "100000000000",
        stampNanoseconds: "96000000000",
        maxDelaySeconds: autowareMaxDelaySeconds
      })
  });
  const carmaPair = buildStrictPair({
    caseId: "POS-02-CARMA-GNSS",
    adapterId: "carma-gnss-duration-greater-than",
    nowNanoseconds: "10000000000",
    stampNanoseconds: "9400000000",
    thresholdNanoseconds: carmaThresholdNanoseconds,
    sourceOffsetsNanoseconds: ["0", "300000000"],
    runAdapter: () =>
      replayCarmaGnssTimeout({
        nowNanoseconds: "10000000000",
        stampNanoseconds: "9400000000",
        gnssDataTimeoutMilliseconds: carmaGnssTimeoutMilliseconds
      })
  });
  const strictPositivePairs = [autowarePair, carmaPair];
  const receiptTimeRedesign = [
    buildReceiptTimeRedesign(autowarePair, (localReceiptNanoseconds) =>
      replayAutowareTimeout({
        nowNanoseconds: autowarePair.visibleInputs.nowNanoseconds,
        stampNanoseconds: localReceiptNanoseconds,
        maxDelaySeconds: autowareMaxDelaySeconds
      })
    ),
    buildReceiptTimeRedesign(carmaPair, (localReceiptNanoseconds) =>
      replayCarmaGnssTimeout({
        nowNanoseconds: carmaPair.visibleInputs.nowNanoseconds,
        stampNanoseconds: localReceiptNanoseconds,
        gnssDataTimeoutMilliseconds: carmaGnssTimeoutMilliseconds
      })
    )
  ];
  const boundedProvenance = strictPositivePairs.map(buildBoundedControl);
  const sameClock = buildSameClockControl();

  return {
    adapterScope:
      "Minimal JavaScript equivalents of the frozen subtraction, units, comparator, and immediate timeout-controlled branch predicate.",
    pairIdentityDefinition:
      "SHA-256 of canonical JSON containing case, adapter, visible now, visible incoming stamp, threshold, and comparator; clock mappings are intentionally excluded.",
    strictPositivePairs,
    pairIdentities: strictPositivePairs.map((pair) => ({
      caseId: pair.visibleInputs.caseId,
      pairId: pair.pairId,
      visibleInputSha256: pair.visibleInputSha256
    })),
    controls: {
      sameClock,
      receiptTimeRedesign,
      boundedProvenance
    },
    results: {
      strictPositivePairCount: strictPositivePairs.length,
      sourceExpressionTimeoutSameWithinEveryPair: strictPositivePairs.every(
        (pair) => pair.checks.sourceExpressionTimeoutIdenticalAcrossWorlds
      ),
      referenceDeadlineTruthOppositeWithinEveryPair: strictPositivePairs.every(
        (pair) => pair.checks.referenceDeadlineTruthOppositeAcrossWorlds
      ),
      sameClockControlInvariant:
        sameClock.checks.sourceExpressionAndReferenceTruthInvariant,
      receiptTimeRedesignInvariantToRemoteMapping: receiptTimeRedesign.every(
        (control) => control.checks.invariantToRemoteClockMapping
      ),
      boundedProvenanceVerdictsUncertain: boundedProvenance.every(
        (control) => control.result.verdict === "uncertain"
      )
    }
  };
}

function localArtifactHashes() {
  const paths = [
    "scripts/idea-pilots/clock-public-path-replay.mjs",
    "test/clock-public-path-replay.test.mjs"
  ];
  return Object.fromEntries(
    paths.map((path) => {
      const absolutePath = resolve(REPOSITORY_ROOT, path);
      return [
        path,
        existsSync(absolutePath) ? sha256Text(readFileSync(absolutePath)) : null
      ];
    })
  );
}

export function runReplay() {
  const sourceAudit = verifySourceAudit();
  const sourceVerification = verifyFrozenSources();
  const mechanicalExtraction = mechanicallyExtractSemantics(sourceVerification);
  const experiment = buildReplayExperiment({
    autowareMaxDelaySeconds:
      mechanicalExtraction.autoware.threshold.configuredValue,
    carmaGnssTimeoutMilliseconds:
      mechanicalExtraction.carma.threshold.configuredDefault
  });
  const sourceContractsSha256 = sha256Json(SOURCE_CONTRACTS);
  return {
    schemaVersion: "1.0.0",
    auditId: "cooperative-autonomous-driving-clock-public-path-replay-v5",
    directionId: "cooperative-autonomous-driving",
    candidateId: "clock-domain-provenance-age-identifiability",
    mode: "read-only-source-equivalent-time-semantics-replay",
    purpose:
      "Evaluate only whether each frozen source expression's visible now, incoming stamp, and threshold identify reference-clock deadline truth.",
    execution: {
      executedAt: new Date().toISOString(),
      command:
        "node scripts/idea-pilots/clock-public-path-replay.mjs --output content/idea-audits/cooperative-autonomous-driving-clock-public-path-replay-v5.json",
      testCommand: "node --test test/clock-public-path-replay.test.mjs",
      runtime: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      },
      sourceAudit,
      sourceContractsSha256,
      localArtifactSha256: localArtifactHashes()
    },
    sourceVerification,
    mechanicalExtraction,
    pairIdentityDefinition: experiment.pairIdentityDefinition,
    pairIdentities: experiment.pairIdentities,
    strictPositivePairs: experiment.strictPositivePairs,
    controls: experiment.controls,
    results: experiment.results,
    limitations: LIMITATIONS,
    claimBoundary: CLAIM_BOUNDARY
  };
}

function parseOutputArgument(argv) {
  const outputIndex = argv.indexOf("--output");
  if (outputIndex === -1) return null;
  invariant(argv[outputIndex + 1], "--output requires a path");
  return resolve(process.cwd(), argv[outputIndex + 1]);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  const payload = `${JSON.stringify(runReplay(), null, 2)}\n`;
  const outputPath = parseOutputArgument(process.argv.slice(2));
  if (outputPath) {
    writeFileSync(outputPath, payload);
  } else {
    process.stdout.write(payload);
  }
}
