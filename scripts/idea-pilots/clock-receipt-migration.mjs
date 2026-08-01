import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = resolve(dirname(SCRIPT_PATH), "../..");

export const REPLAY_PATH =
  "content/idea-audits/cooperative-autonomous-driving-clock-public-path-replay-v5.json";
export const OBLIGATION_PATH =
  "content/idea-audits/cooperative-autonomous-driving-clock-freshness-obligation-pilot-v6.json";
export const OBLIGATION_HEADER_PATH =
  "scripts/idea-pilots/clock_obligation.hpp";
export const OUTPUT_PATH =
  "content/idea-audits/cooperative-autonomous-driving-clock-receipt-migration-v7.json";
export const TEST_PATH = "test/clock-receipt-migration.test.mjs";

const EXPECTED_REPLAY_SHA256 =
  "d82bc07378bf5d49f5765291689a58b517b5133f14a3805f39f3985adab07ef8";
const EXPECTED_OBLIGATION_SHA256 =
  "9ea7b7319f9e28e2360b185d4a1ee2f43c55fa8b2967c64cf948f97de9a2fa03";
const EXPECTED_OBLIGATION_HEADER_SHA256 =
  "77238dac64b1438aa92d61975f85493b68387794c812862af956d97ea438325b";

const AUTOWARE_PREFIX =
  "planning/behavior_velocity_planner/" +
  "autoware_behavior_velocity_virtual_traffic_light_module";

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
    thresholdNanoseconds: "3000000000",
    expectedComparator: ">",
    changedPaths: [
      `${AUTOWARE_PREFIX}/src/manager.hpp`,
      `${AUTOWARE_PREFIX}/src/manager.cpp`,
      `${AUTOWARE_PREFIX}/src/scene.hpp`,
      `${AUTOWARE_PREFIX}/src/scene.cpp`
    ],
    files: [
      {
        path: `${AUTOWARE_PREFIX}/src/manager.hpp`,
        expectedSha256:
          "b0436b0facf82e54f5b5b637841940df92c6865308e247686e50b73f2fc6e553"
      },
      {
        path: `${AUTOWARE_PREFIX}/src/manager.cpp`,
        expectedSha256:
          "5a97a5331b7e433a9a5736d84a348be7e07f40b63d65fe5188e369ab828549c2"
      },
      {
        path: `${AUTOWARE_PREFIX}/src/scene.hpp`,
        expectedSha256:
          "f5ad43e1aae6c37012d47833c4f432e7a0a451a42e8f17903f30189a0055110d"
      },
      {
        path: `${AUTOWARE_PREFIX}/src/scene.cpp`,
        expectedSha256:
          "5ac459db0f8143b15ed827973ed057fad2d4ca7af6e7bdce29b85b09f9c6fc32"
      },
      {
        path:
          "common/autoware_universe_utils/include/autoware/universe_utils/" +
          "ros/polling_subscriber.hpp",
        expectedSha256:
          "3b56de3fc7c8f2d0cff6764e44bd5597df3945a6bf2cfa9633710aeb98d9c81a",
        referenceOnly: true
      }
    ]
  },
  {
    caseId: "POS-02-CARMA-GNSS",
    repository: "usdot-fhwa-stol/carma-platform",
    root: "/private/tmp/clock-audit-carma-platform",
    expectedCommit: "1c774df099ce23e77394758969bf86b0e5f40863",
    thresholdNanoseconds: "500000000",
    expectedComparator: ">",
    changedPaths: [
      "localization_manager/include/localization_manager/LocalizationManager.hpp",
      "localization_manager/src/LocalizationManager.cpp"
    ],
    files: [
      {
        path:
          "localization_manager/include/localization_manager/LocalizationManager.hpp",
        expectedSha256:
          "8640caa978a0ec07358e07b49293187cb5eee2a4a5ce5962e7d79c17c70c63af"
      },
      {
        path: "localization_manager/src/LocalizationManager.cpp",
        expectedSha256:
          "ee5d41fa49cffffe773c9f216d0675ea50c68dd48d22f4b6c03db8aaf0981bc2"
      },
      {
        path: "localization_manager/src/LocalizationTransitionTable.cpp",
        expectedSha256:
          "9dc296dfdfb4ebef3f2b085293480d87b11cfb7d3481193b5f0a247cb8da7f11",
        referenceOnly: true
      }
    ]
  }
]);

const AUTOWARE_REPLACEMENTS = deepFreeze([
  {
    id: "poll-only-new-arrivals-declaration",
    path: `${AUTOWARE_PREFIX}/src/manager.hpp`,
    before: `  autoware_utils::InterProcessPollingSubscriber<
    tier4_v2x_msgs::msg::VirtualTrafficLightStateArray>::SharedPtr
    sub_virtual_traffic_light_states_;`,
    after: `  autoware_utils::InterProcessPollingSubscriber<
    tier4_v2x_msgs::msg::VirtualTrafficLightStateArray,
    autoware_utils::polling_policy::Newest>::SharedPtr
    sub_virtual_traffic_light_states_;`
  },
  {
    id: "poll-only-new-arrivals-construction",
    path: `${AUTOWARE_PREFIX}/src/manager.cpp`,
    before: `  sub_virtual_traffic_light_states_ = autoware_utils::InterProcessPollingSubscriber<
    tier4_v2x_msgs::msg::VirtualTrafficLightStateArray>::
    create_subscription(&node, "~/input/virtual_traffic_light_states");`,
    after: `  sub_virtual_traffic_light_states_ = autoware_utils::InterProcessPollingSubscriber<
    tier4_v2x_msgs::msg::VirtualTrafficLightStateArray,
    autoware_utils::polling_policy::Newest>::
    create_subscription(&node, "~/input/virtual_traffic_light_states");`
  },
  {
    id: "receipt-clock-include",
    path: `${AUTOWARE_PREFIX}/src/scene.hpp`,
    before: "#include <functional>",
    after: "#include <chrono>\n#include <functional>"
  },
  {
    id: "receipt-clock-alias",
    path: `${AUTOWARE_PREFIX}/src/scene.hpp`,
    before: "private:\n  const int64_t lane_id_;",
    after:
      "private:\n  using ReceiptClock = std::chrono::steady_clock;\n\n" +
      "  const int64_t lane_id_;"
  },
  {
    id: "receipt-member-declaration-and-empty-initialization",
    path: `${AUTOWARE_PREFIX}/src/scene.hpp`,
    before:
      "  std::optional<tier4_v2x_msgs::msg::VirtualTrafficLightState> " +
      "virtual_traffic_light_state_;\n",
    after:
      "  std::optional<tier4_v2x_msgs::msg::VirtualTrafficLightState> " +
      "virtual_traffic_light_state_;\n" +
      "  std::optional<ReceiptClock::time_point> " +
      "virtual_traffic_light_state_received_at_{};\n"
  },
  {
    id: "timeout-signature-drops-source-message",
    path: `${AUTOWARE_PREFIX}/src/scene.hpp`,
    before:
      "  bool isStateTimeout(" +
      "const tier4_v2x_msgs::msg::VirtualTrafficLightState & state);",
    after: "  bool isStateTimeout();"
  },
  {
    id: "receipt-duration-include",
    path: `${AUTOWARE_PREFIX}/src/scene.cpp`,
    before: "#include <memory>",
    after: "#include <chrono>\n#include <memory>"
  },
  {
    id: "timeout-call-drops-source-message",
    path: `${AUTOWARE_PREFIX}/src/scene.cpp`,
    expectedCount: 2,
    before: "isStateTimeout(*virtual_traffic_light_state_)",
    after: "isStateTimeout()"
  },
  {
    id: "timeout-uses-local-receipt-only",
    path: `${AUTOWARE_PREFIX}/src/scene.cpp`,
    before: `bool VirtualTrafficLightModule::isStateTimeout(
  const tier4_v2x_msgs::msg::VirtualTrafficLightState & state)
{
  const auto delay = (clock_->now() - rclcpp::Time(state.stamp)).seconds();
  if (delay > planner_param_.max_delay_sec) {
    logDebug("delay=%f, max_delay=%f", delay, planner_param_.max_delay_sec);
    return true;
  }

  return false;
}`,
    after: `bool VirtualTrafficLightModule::isStateTimeout()
{
  if (!virtual_traffic_light_state_received_at_) {
    logDebug("virtual traffic light receipt time is unavailable");
    return true;
  }

  const auto now = ReceiptClock::now();
  if (now < *virtual_traffic_light_state_received_at_) {
    logDebug("virtual traffic light receipt clock moved backwards");
    return true;
  }

  const auto delay =
    std::chrono::duration<double>(now - *virtual_traffic_light_state_received_at_).count();
  if (delay > planner_param_.max_delay_sec) {
    logDebug("delay=%f, max_delay=%f", delay, planner_param_.max_delay_sec);
    return true;
  }

  return false;
}`
  },
  {
    id: "store-local-receipt-at-state-store-boundary",
    path: `${AUTOWARE_PREFIX}/src/scene.cpp`,
    before: `    virtual_traffic_light_state_ = state;
    return;`,
    after: `    virtual_traffic_light_state_received_at_ = ReceiptClock::now();
    virtual_traffic_light_state_ = state;
    return;`
  }
]);

const CARMA_REPLACEMENTS = deepFreeze([
  {
    id: "receipt-clock-include",
    path:
      "localization_manager/include/localization_manager/LocalizationManager.hpp",
    before: "#include <functional>",
    after: "#include <chrono>\n#include <functional>"
  },
  {
    id: "receipt-clock-alias",
    path:
      "localization_manager/include/localization_manager/LocalizationManager.hpp",
    before:
      "    private:\n" +
      "        //! The set of strings which mark a lidar failure in a system alert message",
    after:
      "    private:\n" +
      "        using ReceiptClock = std::chrono::steady_clock;\n\n" +
      "        //! The set of strings which mark a lidar failure in a system alert message"
  },
  {
    id: "receipt-member-declaration-and-empty-initialization",
    path:
      "localization_manager/include/localization_manager/LocalizationManager.hpp",
    before:
      "        boost::optional<geometry_msgs::msg::PoseStamped> " +
      "last_raw_gnss_value_;\n",
    after:
      "        boost::optional<geometry_msgs::msg::PoseStamped> " +
      "last_raw_gnss_value_;\n" +
      "        boost::optional<ReceiptClock::time_point> " +
      "last_raw_gnss_received_at_{};\n"
  },
  {
    id: "receipt-duration-include",
    path: "localization_manager/src/LocalizationManager.cpp",
    before: "#include <algorithm>",
    after: "#include <algorithm>\n#include <chrono>"
  },
  {
    id: "store-local-receipt-at-gnss-callback-boundary",
    path: "localization_manager/src/LocalizationManager.cpp",
    before: `    {
        last_raw_gnss_value_ = *msg;
        // Just like ndt_matching`,
    after: `    {
        last_raw_gnss_received_at_ = ReceiptClock::now();
        last_raw_gnss_value_ = *msg;
        // Just like ndt_matching`
  },
  {
    id: "timeout-uses-local-receipt-only",
    path: "localization_manager/src/LocalizationManager.cpp",
    before: `        // check if last gnss time stamp is older than threshold and send the corresponding signal
        if (last_raw_gnss_value_ && timer_factory_->now() - rclcpp::Time(last_raw_gnss_value_->header.stamp, timer_clock_type_) > rclcpp::Duration::from_nanoseconds(config_.gnss_data_timeout * 1e6))
        {
            transition_table_.signal(LocalizationSignal::GNSS_DATA_TIMEOUT);
        }`,
    after: `        // Check elapsed local time since the last GNSS callback.
        const auto gnss_receipt_now = ReceiptClock::now();
        const auto gnss_timeout = std::chrono::milliseconds(config_.gnss_data_timeout);
        if (
            last_raw_gnss_value_ &&
            (!last_raw_gnss_received_at_ ||
             gnss_receipt_now < *last_raw_gnss_received_at_ ||
             gnss_receipt_now - *last_raw_gnss_received_at_ > gnss_timeout))
        {
            transition_table_.signal(LocalizationSignal::GNSS_DATA_TIMEOUT);
        }`
  }
]);

const REPLACEMENTS_BY_CASE = new Map([
  ["POS-01-AUTOWARE-VTL", AUTOWARE_REPLACEMENTS],
  ["POS-02-CARMA-GNSS", CARMA_REPLACEMENTS]
]);

export const MUTANT_DEFINITIONS = deepFreeze([
  {
    id: "continues-using-source-stamp",
    category: "source-stamp",
    description:
      "The decision subtracts the remote source stamp instead of the local receipt."
  },
  {
    id: "accepts-wrong-clock",
    category: "wrong-clock",
    description:
      "The decision omits the receipt/decision clock-domain equality check."
  },
  {
    id: "missing-receipt-defaults-fresh",
    category: "missing-receipt-store",
    description:
      "A stored message without a receipt timestamp is treated as fresh."
  },
  {
    id: "changes-boundary-to-inclusive",
    category: "comparison-boundary",
    description:
      "The fixed strict greater-than comparator is changed to greater-or-equal."
  },
  {
    id: "overwrites-receipt-during-replay",
    category: "receipt-overwrite-replay",
    description:
      "The decision boundary overwrites receipt with now, modeling cached replay refresh."
  },
  {
    id: "negative-age-defaults-fresh",
    category: "negative-age",
    description:
      "A backwards local-clock observation is coerced to fresh."
  },
  {
    id: "overflow-defaults-fresh",
    category: "overflow",
    description:
      "An unrepresentable signed elapsed duration is coerced to fresh."
  }
]);

export const CLAIM_BOUNDARY = deepFreeze({
  supported: [
    "At the two fixed commits, the declared source blobs and exact replacement anchors match their recorded SHA-256 values.",
    "The generated unified diffs apply to temporary snapshots with git apply --check and git apply, and only the declared files change.",
    "The patched timeout operands implement time-since-local-receipt with one process-local steady clock; remote source stamps are not freshness operands.",
    "For a stored message, missing receipt, clock-domain or local epoch mismatch, negative elapsed time, and unrepresentable elapsed time are fail-closed in the generated C++17 harness.",
    "The mechanically generated C++17 harness compiles and runs fresh, timeout, strict-equality, remote-stamp invariance, and case-specific fail-closed action checks.",
    "Every declared mutant is compiled, run, and killed by at least one harness check."
  ],
  notSupported: [
    "This is an explicit semantic migration to time-since-local-receipt; it does not preserve or estimate source-event-age.",
    "Neither the full Autoware project nor the full CARMA project is built in this environment.",
    "Patch applicability is not evidence of project compilation, ABI compatibility, deployment reachability, scheduling behavior, or runtime integration.",
    "No safety benefit, product defect, vulnerability, incident frequency, or field clock condition is inferred.",
    "Autoware's Newest polling change prevents cached planner-cycle replay from refreshing receipt; it is not a network anti-replay mechanism, and a newly delivered duplicate is a new local receipt.",
    "The harness is a mechanically bound policy model, not execution of ROS 2, Autoware, CARMA, or their transition machinery."
  ]
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options
  });
  if (options.allowFailure) return result;
  invariant(
    result.status === 0,
    `${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`
  );
  return result;
}

function git(root, args, options = {}) {
  return run("git", ["-C", root, ...args], options);
}

function gitFile(root, commit, path) {
  return git(root, ["show", `${commit}:${path}`]).stdout;
}

function countOccurrences(text, needle) {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = text.indexOf(needle, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + needle.length;
  }
}

function replaceExactly(text, replacement) {
  const expectedCount = replacement.expectedCount ?? 1;
  const observedCount = countOccurrences(text, replacement.before);
  invariant(
    observedCount === expectedCount,
    `${replacement.id}: expected ${expectedCount} anchor(s), found ${observedCount}`
  );
  return text.split(replacement.before).join(replacement.after);
}

function lineSpan(text, needle) {
  const index = text.indexOf(needle);
  invariant(index !== -1, "Cannot locate line span");
  const start = text.slice(0, index).split("\n").length;
  return [start, start + needle.split("\n").length - 1];
}

function writeTree(root, files) {
  for (const [path, text] of files) {
    const target = resolve(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
}

function initializeTemporaryRepository(root, files) {
  writeTree(root, files);
  git(root, ["init", "-q"]);
  git(root, ["add", "--", ...files.keys()]);
  git(root, [
    "-c",
    "user.name=Clock Receipt Pilot",
    "-c",
    "user.email=clock-receipt@example.invalid",
    "commit",
    "-qm",
    "fixed source snapshot"
  ]);
}

function makeUnifiedDiff(beforeFiles, afterFiles) {
  const directory = mkdtempSync(resolve(tmpdir(), "clock-receipt-diff-"));
  try {
    initializeTemporaryRepository(directory, beforeFiles);
    writeTree(directory, afterFiles);
    const diff = git(directory, [
      "diff",
      "--no-ext-diff",
      "--src-prefix=a/",
      "--dst-prefix=b/",
      "--"
    ]).stdout;
    invariant(diff.length > 0, "Generated patch is empty");
    return diff;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function verifyPatchApplicability(beforeFiles, expectedAfterFiles, patch, expectedPaths) {
  const directory = mkdtempSync(resolve(tmpdir(), "clock-receipt-apply-"));
  try {
    initializeTemporaryRepository(directory, beforeFiles);
    const beforeHashes = Object.fromEntries(
      [...beforeFiles].map(([path, text]) => [path, sha256(text)])
    );
    const check = git(
      directory,
      ["apply", "--check", "--whitespace=error-all", "-"],
      { input: patch, allowFailure: true }
    );
    invariant(check.status === 0, `git apply --check failed: ${check.stderr}`);
    const apply = git(
      directory,
      ["apply", "--whitespace=error-all", "-"],
      { input: patch, allowFailure: true }
    );
    invariant(apply.status === 0, `git apply failed: ${apply.stderr}`);
    const changedPaths = git(directory, ["diff", "--name-only", "--"])
      .stdout.trim()
      .split("\n")
      .filter(Boolean);
    invariant(
      JSON.stringify(changedPaths) === JSON.stringify([...expectedPaths].sort()),
      `Applied patch changed unexpected paths: ${changedPaths.join(", ")}`
    );
    const appliedDiff = git(directory, [
      "diff",
      "--no-ext-diff",
      "--src-prefix=a/",
      "--dst-prefix=b/",
      "--"
    ]).stdout;
    invariant(appliedDiff === patch, "Applied diff differs from generated patch");
    const afterHashes = Object.fromEntries(
      [...expectedAfterFiles].map(([path, expected]) => {
        const actual = readFileSync(resolve(directory, path), "utf8");
        invariant(actual === expected, `Applied content mismatch for ${path}`);
        return [path, sha256(actual)];
      })
    );
    return {
      temporarySnapshot: true,
      fixedCheckoutModified: false,
      gitApplyCheckExitStatus: check.status,
      gitApplyExitStatus: apply.status,
      changedPaths,
      onlyExpectedFilesChanged: true,
      appliedDiffMatchesGeneratedDiff: true,
      beforeSha256: beforeHashes,
      afterSha256: afterHashes
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function verifyProvenanceInputs() {
  const inputs = [
    [REPLAY_PATH, EXPECTED_REPLAY_SHA256],
    [OBLIGATION_PATH, EXPECTED_OBLIGATION_SHA256],
    [OBLIGATION_HEADER_PATH, EXPECTED_OBLIGATION_HEADER_SHA256]
  ].map(([path, expectedSha256]) => {
    const text = readFileSync(resolve(REPOSITORY_ROOT, path), "utf8");
    invariant(sha256(text) === expectedSha256, `${path} changed`);
    return { path, sha256: expectedSha256 };
  });
  const header = readFileSync(
    resolve(REPOSITORY_ROOT, OBLIGATION_HEADER_PATH),
    "utf8"
  );
  for (const token of [
    "since_local_receipt",
    "SameDomainLocalReceipt",
    "RelockMismatch",
    "NegativeAge"
  ]) {
    invariant(header.includes(token), `Obligation header lacks ${token}`);
  }
  return inputs;
}

function verifyReplayBinding(contract, replay) {
  const source = replay.sourceVerification.find(
    (entry) => entry.caseId === contract.caseId
  );
  const pair = replay.strictPositivePairs.find(
    (entry) => entry.visibleInputs.caseId === contract.caseId
  );
  invariant(source, `Replay lacks source verification for ${contract.caseId}`);
  invariant(pair, `Replay lacks strict pair for ${contract.caseId}`);
  invariant(
    source.expectedCommit === contract.expectedCommit,
    `${contract.caseId} replay commit changed`
  );
  invariant(
    pair.visibleInputs.comparator === contract.expectedComparator,
    `${contract.caseId} replay comparator changed`
  );
  invariant(
    pair.visibleInputs.thresholdNanoseconds === contract.thresholdNanoseconds,
    `${contract.caseId} replay threshold changed`
  );
  return {
    pairId: pair.pairId,
    visibleInputSha256: pair.visibleInputSha256,
    thresholdNanoseconds: pair.visibleInputs.thresholdNanoseconds,
    comparator: pair.visibleInputs.comparator
  };
}

function sourceFilesFor(contract) {
  const observedHead = git(contract.root, ["rev-parse", "HEAD"]).stdout.trim();
  const status = git(contract.root, ["status", "--porcelain"]).stdout;
  invariant(
    observedHead === contract.expectedCommit,
    `${contract.caseId} checkout is at ${observedHead}`
  );
  invariant(status === "", `${contract.caseId} fixed checkout is not clean`);
  const files = new Map();
  const verification = [];
  for (const file of contract.files) {
    const text = gitFile(contract.root, contract.expectedCommit, file.path);
    const observedSha256 = sha256(text);
    invariant(
      observedSha256 === file.expectedSha256,
      `${contract.caseId} source hash mismatch for ${file.path}`
    );
    files.set(file.path, text);
    verification.push({
      path: file.path,
      referenceOnly: Boolean(file.referenceOnly),
      sha256: observedSha256
    });
  }
  return {
    files,
    verification: {
      caseId: contract.caseId,
      repository: contract.repository,
      readOnlyRoot: contract.root,
      expectedCommit: contract.expectedCommit,
      observedHead,
      commitMatches: true,
      worktreeCleanBefore: true,
      files: verification
    }
  };
}

function applyMechanicalReplacements(contract, beforeFiles) {
  const replacements = REPLACEMENTS_BY_CASE.get(contract.caseId);
  invariant(replacements, `No replacements for ${contract.caseId}`);
  const afterFiles = new Map(beforeFiles);
  const anchors = [];
  for (const replacement of replacements) {
    const beforeText = afterFiles.get(replacement.path);
    invariant(beforeText !== undefined, `Missing ${replacement.path}`);
    const beforeLines = lineSpan(beforeText, replacement.before);
    const changed = replaceExactly(beforeText, replacement);
    const afterLines = lineSpan(changed, replacement.after);
    afterFiles.set(replacement.path, changed);
    anchors.push({
      id: replacement.id,
      path: replacement.path,
      occurrenceCount: replacement.expectedCount ?? 1,
      beforeLines,
      afterLines,
      beforeSha256: sha256(replacement.before),
      afterSha256: sha256(replacement.after)
    });
  }
  const changedPaths = [...afterFiles]
    .filter(([path, text]) => text !== beforeFiles.get(path))
    .map(([path]) => path)
    .sort();
  invariant(
    JSON.stringify(changedPaths) ===
      JSON.stringify([...contract.changedPaths].sort()),
    `${contract.caseId} mechanical changes do not match declared paths`
  );
  return { afterFiles, anchors };
}

function extractComparator(text, left, right) {
  const pattern = new RegExp(
    `${left.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(>=|>)\\s*` +
      right.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const match = text.match(pattern);
  invariant(match, `Cannot extract comparator between ${left} and ${right}`);
  return match[1];
}

function extractMechanicalSemantics(contract, beforeFiles, afterFiles) {
  if (contract.caseId === "POS-01-AUTOWARE-VTL") {
    const path = `${AUTOWARE_PREFIX}/src/scene.cpp`;
    const managerPath = `${AUTOWARE_PREFIX}/src/manager.hpp`;
    const before = beforeFiles.get(path);
    const after = afterFiles.get(path);
    const beforeExpression =
      "(clock_->now() - rclcpp::Time(state.stamp)).seconds()";
    const afterExpression =
      "std::chrono::duration<double>(" +
      "now - *virtual_traffic_light_state_received_at_).count()";
    const receiptStoreExpression =
      "virtual_traffic_light_state_received_at_ = ReceiptClock::now()";
    for (const [label, text, needle] of [
      ["before timeout", before, beforeExpression],
      ["after timeout", after, afterExpression],
      ["receipt store", after, receiptStoreExpression]
    ]) {
      invariant(text.includes(needle), `${label} expression is missing`);
    }
    const beforeComparator = extractComparator(
      before,
      "delay",
      "planner_param_.max_delay_sec"
    );
    const afterComparator = extractComparator(
      after,
      "delay",
      "planner_param_.max_delay_sec"
    );
    const managerAfter = afterFiles.get(managerPath);
    invariant(
      managerAfter.includes("autoware_utils::polling_policy::Newest"),
      "Autoware migration does not prevent cached Latest replay refresh"
    );
    invariant(
      before.includes("insertStopVelocityAtStopLine(path, end_line_idx);"),
      "Autoware fail-closed action is missing"
    );
    return {
      semanticTargetBefore: "source-event-age-without-clock-relation",
      semanticTargetAfter: "time-since-local-receipt",
      beforeExpression,
      afterExpression,
      beforeComparator,
      afterComparator,
      localClockType: "std::chrono::steady_clock",
      localNowExpression: "ReceiptClock::now()",
      receiptStoreExpression,
      remoteStampOperandBefore: "state.stamp",
      remoteStampOperandAfter: null,
      missingReceiptAction: "return timeout",
      negativeAgeAction: "return timeout",
      downstreamAction: "insertStopVelocityAtStopLine",
      cachedReplayHandling:
        "polling_policy::Newest returns nullptr when no newly taken message exists"
    };
  }

  const path = "localization_manager/src/LocalizationManager.cpp";
  const transitionPath =
    "localization_manager/src/LocalizationTransitionTable.cpp";
  const before = beforeFiles.get(path);
  const after = afterFiles.get(path);
  const transition = beforeFiles.get(transitionPath);
  const beforeExpression =
    "timer_factory_->now() - " +
    "rclcpp::Time(last_raw_gnss_value_->header.stamp, timer_clock_type_)";
  const afterExpression =
    "gnss_receipt_now - *last_raw_gnss_received_at_";
  const receiptStoreExpression =
    "last_raw_gnss_received_at_ = ReceiptClock::now()";
  for (const [label, text, needle] of [
    ["before timeout", before, beforeExpression],
    ["after timeout", after, afterExpression],
    ["receipt store", after, receiptStoreExpression]
  ]) {
    invariant(text.includes(needle), `${label} expression is missing`);
  }
  const beforeComparator = extractComparator(
    before,
    beforeExpression,
    "rclcpp::Duration::from_nanoseconds(config_.gnss_data_timeout * 1e6)"
  );
  const afterComparator = extractComparator(
    after,
    afterExpression,
    "gnss_timeout"
  );
  invariant(
    after.includes(
      "transition_table_.signal(LocalizationSignal::GNSS_DATA_TIMEOUT);"
    ),
    "CARMA timeout signal is missing"
  );
  invariant(
    transition.includes(
      'throw std::runtime_error("GNSS_DATA_TIMEOUT occurred while in ' +
        'DEGRADED_NO_LIDAR_FIX state. Localization cannot recover");'
    ),
    "CARMA degraded timeout action is missing"
  );
  return {
    semanticTargetBefore: "source-event-age-without-clock-relation",
    semanticTargetAfter: "time-since-local-receipt",
    beforeExpression,
    afterExpression,
    beforeComparator,
    afterComparator,
    localClockType: "std::chrono::steady_clock",
    localNowExpression: "ReceiptClock::now()",
    receiptStoreExpression,
    remoteStampOperandBefore: "last_raw_gnss_value_->header.stamp",
    remoteStampOperandAfter: null,
    missingReceiptAction: "signal GNSS_DATA_TIMEOUT for a stored GNSS message",
    negativeAgeAction: "signal GNSS_DATA_TIMEOUT",
    downstreamAction: "signal LocalizationSignal::GNSS_DATA_TIMEOUT",
    degradedStateAction:
      "throw runtime_error when state is DEGRADED_NO_LIDAR_FIX"
  };
}

export function buildSourceBoundMigration() {
  const provenanceInputs = verifyProvenanceInputs();
  const replay = JSON.parse(
    readFileSync(resolve(REPOSITORY_ROOT, REPLAY_PATH), "utf8")
  );
  const cases = SOURCE_CONTRACTS.map((contract) => {
    const replayBinding = verifyReplayBinding(contract, replay);
    const source = sourceFilesFor(contract);
    const { afterFiles, anchors } = applyMechanicalReplacements(
      contract,
      source.files
    );
    const patch = makeUnifiedDiff(source.files, afterFiles);
    const applicability = verifyPatchApplicability(
      source.files,
      afterFiles,
      patch,
      contract.changedPaths
    );
    const semantics = extractMechanicalSemantics(
      contract,
      source.files,
      afterFiles
    );
    invariant(
      semantics.beforeComparator === contract.expectedComparator &&
        semantics.afterComparator === contract.expectedComparator,
      `${contract.caseId} comparator was not preserved`
    );
    const changedFiles = contract.changedPaths.map((path) => ({
      path,
      beforeSha256: sha256(source.files.get(path)),
      afterSha256: sha256(afterFiles.get(path))
    }));
    const finalStatus = git(contract.root, ["status", "--porcelain"]).stdout;
    invariant(
      finalStatus === "",
      `${contract.caseId} fixed checkout changed during migration evidence`
    );
    source.verification.worktreeCleanAfter = true;
    return {
      caseId: contract.caseId,
      replayBinding,
      sourceVerification: source.verification,
      replacementAnchors: anchors,
      mechanicalSemantics: semantics,
      patch: {
        format: "unified-diff",
        sha256: sha256(patch),
        changedFiles,
        unifiedDiff: patch
      },
      actualPatchApplicability: applicability
    };
  });
  return { provenanceInputs, cases };
}

function checkedReceiptDecision({
  nowNanoseconds,
  nowClockDomain,
  nowEpoch,
  receiptNanoseconds,
  receiptClockDomain,
  receiptEpoch,
  receiptPresent,
  thresholdNanoseconds,
  comparator
}) {
  if (!receiptPresent) return "uncertain";
  if (
    nowClockDomain !== receiptClockDomain ||
    nowEpoch !== receiptEpoch
  ) {
    return "uncertain";
  }
  const now = BigInt(nowNanoseconds);
  const receipt = BigInt(receiptNanoseconds);
  const threshold = BigInt(thresholdNanoseconds);
  if (now < receipt || threshold < 0n) return "uncertain";
  const age = now - receipt;
  if (age > 9223372036854775807n) return "uncertain";
  if (comparator === ">") return age > threshold ? "timeout" : "fresh";
  if (comparator === ">=") return age >= threshold ? "timeout" : "fresh";
  throw new Error(`Unsupported comparator ${comparator}`);
}

export function evaluateReceiptFreshness(input) {
  return checkedReceiptDecision(input);
}

function cppString(value) {
  return JSON.stringify(value);
}

function generateHarnessSource(cases, mutantId = null) {
  const comparators = new Set(
    cases.map((entry) => entry.mechanicalSemantics.afterComparator)
  );
  invariant(
    comparators.size === 1 && comparators.has(">"),
    "Harness requires the two mechanically extracted strict comparators"
  );
  const bindings = cases
    .map((entry) => {
      const semantics = entry.mechanicalSemantics;
      return `  {
    ${cppString(entry.caseId)},
    ${cppString(semantics.beforeExpression)},
    ${cppString(semantics.afterExpression)},
    ${cppString(semantics.receiptStoreExpression)},
    ${cppString(semantics.downstreamAction)}
  }`;
    })
    .join(",\n");
  const variant = mutantId ?? "base";
  return `#include <cstdint>
#include <iostream>
#include <limits>
#include <string>
#include <vector>

enum class Verdict { Fresh, Timeout, Uncertain };

struct Binding {
  const char * case_id;
  const char * before_expression;
  const char * after_expression;
  const char * receipt_store_expression;
  const char * fail_closed_action;
};

struct Sample {
  bool receipt_present;
  std::int64_t now_nanoseconds;
  std::int64_t receipt_nanoseconds;
  std::int64_t remote_stamp_nanoseconds;
  std::int64_t threshold_nanoseconds;
  int now_clock_domain;
  int receipt_clock_domain;
  std::uint64_t now_epoch;
  std::uint64_t receipt_epoch;
};

constexpr const char * kComparator = ">";
constexpr const char * kVariant = ${cppString(variant)};
constexpr Binding kBindings[] = {
${bindings}
};

bool strict_compare(std::int64_t age, std::int64_t threshold) {
  if (std::string(kVariant) == "changes-boundary-to-inclusive") {
    return age >= threshold;
  }
  return std::string(kComparator) == ">"
    ? age > threshold
    : age >= threshold;
}

bool checked_age(
  std::int64_t now,
  std::int64_t then,
  std::int64_t & age
) {
  if (now < then) return false;
  if (
    then < 0 &&
    now > std::numeric_limits<std::int64_t>::max() + then
  ) {
    return false;
  }
  age = now - then;
  return true;
}

Verdict decide(Sample sample) {
  const std::string variant(kVariant);
  if (!sample.receipt_present) {
    return variant == "missing-receipt-defaults-fresh"
      ? Verdict::Fresh
      : Verdict::Uncertain;
  }
  if (
    variant != "accepts-wrong-clock" &&
    sample.now_clock_domain != sample.receipt_clock_domain
  ) {
    return Verdict::Uncertain;
  }
  if (sample.now_epoch != sample.receipt_epoch) {
    return Verdict::Uncertain;
  }
  if (variant == "overwrites-receipt-during-replay") {
    sample.receipt_nanoseconds = sample.now_nanoseconds;
  }
  const std::int64_t operand =
    variant == "continues-using-source-stamp"
      ? sample.remote_stamp_nanoseconds
      : sample.receipt_nanoseconds;
  std::int64_t age = 0;
  if (!checked_age(sample.now_nanoseconds, operand, age)) {
    if (
      variant == "negative-age-defaults-fresh" &&
      sample.now_nanoseconds < operand
    ) {
      return Verdict::Fresh;
    }
    if (variant == "overflow-defaults-fresh") {
      return Verdict::Fresh;
    }
    return Verdict::Uncertain;
  }
  return strict_compare(age, sample.threshold_nanoseconds)
    ? Verdict::Timeout
    : Verdict::Fresh;
}

const char * action_for(const Binding & binding, Verdict verdict) {
  if (verdict == Verdict::Fresh) {
    return std::string(binding.case_id).find("AUTOWARE") != std::string::npos
      ? "continue"
      : "no-gnss-timeout-signal";
  }
  return binding.fail_closed_action;
}

int main() {
  static_assert(
    std::numeric_limits<std::int64_t>::is_signed,
    "Harness requires signed 64-bit time operands"
  );
  std::vector<std::string> failures;
  const auto expect = [&failures](
    const char * id,
    bool condition
  ) {
    if (!condition) failures.emplace_back(id);
  };
  const Sample base{
    true, 1050, 1000, 1000000, 100, 7, 7, 3, 3
  };
  expect("fresh", decide(base) == Verdict::Fresh);
  auto timeout = base;
  timeout.now_nanoseconds = 1101;
  expect("timeout", decide(timeout) == Verdict::Timeout);
  auto equality = base;
  equality.now_nanoseconds = 1100;
  expect("strict-equality", decide(equality) == Verdict::Fresh);
  auto remote_a = base;
  remote_a.remote_stamp_nanoseconds = 995;
  auto remote_b = base;
  remote_b.remote_stamp_nanoseconds = 0;
  expect(
    "remote-stamp-offset-invariance",
    decide(remote_a) == decide(remote_b) &&
    decide(remote_a) == Verdict::Fresh
  );
  auto missing = base;
  missing.receipt_present = false;
  expect("missing-receipt", decide(missing) == Verdict::Uncertain);
  auto wrong_clock = base;
  wrong_clock.receipt_clock_domain = 8;
  expect("wrong-clock", decide(wrong_clock) == Verdict::Uncertain);
  auto relocked = base;
  relocked.receipt_epoch = 2;
  expect("local-relock", decide(relocked) == Verdict::Uncertain);
  auto negative = base;
  negative.now_nanoseconds = 999;
  expect("negative-age", decide(negative) == Verdict::Uncertain);
  auto overflow = base;
  overflow.now_nanoseconds = std::numeric_limits<std::int64_t>::max();
  overflow.receipt_nanoseconds = std::numeric_limits<std::int64_t>::min();
  expect("overflow", decide(overflow) == Verdict::Uncertain);
  for (const auto & binding : kBindings) {
    expect(
      (std::string(binding.case_id) + "-timeout-action").c_str(),
      std::string(action_for(binding, Verdict::Timeout)) ==
        binding.fail_closed_action
    );
    expect(
      (std::string(binding.case_id) + "-uncertain-action").c_str(),
      std::string(action_for(binding, Verdict::Uncertain)) ==
        binding.fail_closed_action
    );
  }
  if (!failures.empty()) {
    std::cout << "FAIL:";
    for (std::size_t index = 0; index < failures.size(); ++index) {
      if (index) std::cout << ",";
      std::cout << failures[index];
    }
    return 1;
  }
  std::cout << "PASS:" << (9 + 2 * std::size(kBindings));
  return 0;
}
`;
}

function compileAndRunHarness(directory, id, source) {
  const sourcePath = resolve(directory, `${id}.cpp`);
  const binaryPath = resolve(directory, id);
  writeFileSync(sourcePath, source);
  const compilation = run(
    "/usr/bin/clang++",
    [
      "-std=c++17",
      "-O0",
      "-Wall",
      "-Wextra",
      "-pedantic",
      sourcePath,
      "-o",
      binaryPath
    ],
    { allowFailure: true }
  );
  invariant(
    compilation.status === 0,
    `${id} harness compilation failed: ${compilation.stderr}`
  );
  const execution = run(binaryPath, [], { allowFailure: true });
  return {
    id,
    sourceSha256: sha256(source),
    compileExitStatus: compilation.status,
    compilerStderr: compilation.stderr.trim() || null,
    runExitStatus: execution.status,
    stdout: execution.stdout.trim(),
    stderr: execution.stderr.trim() || null
  };
}

export function runCppHarnessEvidence(cases) {
  invariant(existsSync("/usr/bin/clang++"), "/usr/bin/clang++ is unavailable");
  const directory = mkdtempSync(resolve(tmpdir(), "clock-receipt-harness-"));
  try {
    const compilerVersion = run("/usr/bin/clang++", ["--version"])
      .stdout.split("\n")[0];
    const base = compileAndRunHarness(
      directory,
      "clock-receipt-base",
      generateHarnessSource(cases)
    );
    invariant(
      base.runExitStatus === 0 && base.stdout.startsWith("PASS:"),
      `Base harness failed: ${base.stdout} ${base.stderr || ""}`
    );
    const mutants = MUTANT_DEFINITIONS.map((definition) => {
      const result = compileAndRunHarness(
        directory,
        definition.id,
        generateHarnessSource(cases, definition.id)
      );
      invariant(
        result.runExitStatus !== 0 && result.stdout.startsWith("FAIL:"),
        `${definition.id} mutant survived`
      );
      return {
        ...definition,
        ...result,
        killed: true,
        killedBy: result.stdout.slice("FAIL:".length).split(",")
      };
    });
    return {
      compiler: "/usr/bin/clang++",
      compilerVersion,
      languageMode: "c++17",
      generationBinding:
        "Exact before/after expressions, receipt-store expressions, " +
        "comparators, case IDs, and fail-closed action tokens are extracted " +
        "from the fixed and patched source before C++ generation.",
      base,
      mutants,
      allMutantsKilled: mutants.every((entry) => entry.killed)
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function commandAvailable(command) {
  const result = run("sh", ["-c", `command -v ${command}`], {
    allowFailure: true
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function fullBuildBlockers() {
  const colcon = commandAvailable("colcon");
  const rosRootPresent = existsSync("/opt/ros");
  return SOURCE_CONTRACTS.map((contract) => ({
    caseId: contract.caseId,
    status: "blocked",
    attempted: false,
    reason:
      "The fixed checkout is source-only evidence and this environment has " +
      "no provisioned ROS 2 installation or complete ament workspace dependencies.",
    evidence: {
      rosInstallRoot: "/opt/ros",
      rosInstallRootPresent: rosRootPresent,
      colconPath: colcon,
      dependencyManifest:
        contract.caseId === "POS-01-AUTOWARE-VTL"
          ? `${AUTOWARE_PREFIX}/package.xml`
          : "localization_manager/package.xml"
    },
    conclusion:
      "No full Autoware/CARMA build, link, unit-test, or integration result is claimed."
  }));
}

export function runMigrationPilot() {
  const migration = buildSourceBoundMigration();
  const cppHarness = runCppHarnessEvidence(migration.cases);
  const fullProjectBuilds = fullBuildBlockers();
  const expectedChangedPaths = SOURCE_CONTRACTS.flatMap(
    (contract) => contract.changedPaths
  ).sort();
  const actualChangedPaths = migration.cases.flatMap(
    (entry) => entry.actualPatchApplicability.changedPaths
  ).sort();
  invariant(
    JSON.stringify(actualChangedPaths) === JSON.stringify(expectedChangedPaths),
    "Combined changed paths differ from the source contract"
  );
  invariant(
    migration.cases.every(
      (entry) =>
        entry.mechanicalSemantics.semanticTargetAfter ===
          "time-since-local-receipt" &&
        entry.mechanicalSemantics.remoteStampOperandAfter === null &&
        entry.mechanicalSemantics.afterComparator === ">"
    ),
    "Migration semantics are not receipt-only with strict comparison"
  );
  const localArtifacts = [SCRIPT_PATH, resolve(REPOSITORY_ROOT, TEST_PATH)];
  for (const path of localArtifacts) {
    invariant(existsSync(path), `Local artifact is missing: ${path}`);
  }
  return {
    schemaVersion: 1,
    auditId:
      "cooperative-autonomous-driving-clock-receipt-migration-v7",
    candidateId: "cross-domain-freshness-obligation",
    generatedAt: new Date().toISOString(),
    role:
      "independent C++ migration evidence; no scoring or acceptance threshold",
    purpose:
      "Produce source-bound evidence for an explicit migration from " +
      "source-stamp subtraction to time-since-local-receipt at two fixed commits.",
    provenanceInputs: migration.provenanceInputs,
    semanticContract: {
      target: "time-since-local-receipt",
      explicitlyNotPreserved: "source-event-age",
      receiptClock: "std::chrono::steady_clock",
      comparator: ">",
      equalityVerdict: "fresh",
      failClosedScope:
        "stored message with missing receipt, wrong receipt clock, local " +
        "epoch/relock mismatch, negative age, or unrepresentable elapsed age",
      replayScope:
        "Autoware cached polling replay cannot refresh receipt after the " +
        "Latest-to-Newest change; newly delivered duplicates remain new receipts."
    },
    cases: migration.cases,
    cppHarness,
    fullProjectBuilds,
    execution: {
      localArtifactSha256: {
        "scripts/idea-pilots/clock-receipt-migration.mjs": sha256(
          readFileSync(SCRIPT_PATH)
        ),
        [TEST_PATH]: sha256(readFileSync(resolve(REPOSITORY_ROOT, TEST_PATH)))
      },
      temporaryDirectoriesRemoved: true,
      fixedCheckoutsModified: false
    },
    results: {
      fixedSourceContractsVerified: true,
      actualPatchApplicabilityPassed: true,
      onlyExpectedSourceFilesChanged: true,
      remoteStampRemovedFromFreshnessOperands: true,
      strictComparisonBoundaryPreserved: true,
      harnessCompiledAndRan: true,
      allMutantsKilled: true,
      fullAutowareBuild: "blocked",
      fullCarmaBuild: "blocked"
    },
    claimBoundary: CLAIM_BOUNDARY
  };
}

function writeAudit() {
  const audit = runMigrationPilot();
  const target = resolve(REPOSITORY_ROOT, OUTPUT_PATH);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(audit, null, 2)}\n`);
  process.stdout.write(
    `${OUTPUT_PATH}\n` +
      `patches=${audit.cases.length} ` +
      `mutants=${audit.cppHarness.mutants.length}\n`
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  writeAudit();
}
