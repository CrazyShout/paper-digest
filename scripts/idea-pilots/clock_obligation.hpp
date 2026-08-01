#ifndef PAPER_DIGEST_CLOCK_OBLIGATION_HPP
#define PAPER_DIGEST_CLOCK_OBLIGATION_HPP

#include <algorithm>
#include <cstdint>
#include <limits>

namespace paper_digest::freshness {

struct DecisionNow {};
struct LocalReceipt {};
struct SourceEvent {};

enum class Comparator {
  StrictGreater,
  GreaterOrEqual
};

enum class Verdict {
  Fresh,
  Timeout,
  Uncertain
};

enum class Reason {
  SameDomainLocalReceipt,
  BoundedClockRelation,
  InvalidRelation,
  OutsideValidity,
  RelockMismatch,
  NegativeAge
};

template <typename Domain, typename Origin>
struct Timestamp {
  std::int64_t nanoseconds;
  std::uint64_t relock_counter;
};

template <typename SourceDomain, typename TargetDomain>
struct RelationCertificate {
  std::int64_t valid_from_source_nanoseconds;
  std::int64_t valid_to_source_nanoseconds;
  std::uint64_t relock_counter;
  std::int64_t source_to_target_offset_lower_nanoseconds;
  std::int64_t source_to_target_offset_upper_nanoseconds;
};

struct Result {
  Verdict verdict;
  Reason reason;
  std::int64_t age_lower_nanoseconds;
  std::int64_t age_upper_nanoseconds;
};

inline bool times_out(
  std::int64_t age_nanoseconds,
  std::int64_t threshold_nanoseconds,
  Comparator comparator
) {
  return comparator == Comparator::StrictGreater
    ? age_nanoseconds > threshold_nanoseconds
    : age_nanoseconds >= threshold_nanoseconds;
}

inline Verdict interval_verdict(
  std::int64_t lower_nanoseconds,
  std::int64_t upper_nanoseconds,
  std::int64_t threshold_nanoseconds,
  Comparator comparator
) {
  const bool lower_times_out = times_out(
    lower_nanoseconds,
    threshold_nanoseconds,
    comparator
  );
  const bool upper_times_out = times_out(
    upper_nanoseconds,
    threshold_nanoseconds,
    comparator
  );
  if (lower_times_out && upper_times_out) return Verdict::Timeout;
  if (!lower_times_out && !upper_times_out) return Verdict::Fresh;
  return Verdict::Uncertain;
}

template <typename Domain>
Result since_local_receipt(
  Timestamp<Domain, DecisionNow> now,
  Timestamp<Domain, LocalReceipt> receipt,
  std::int64_t threshold_nanoseconds,
  Comparator comparator
) {
  const std::int64_t age = now.nanoseconds - receipt.nanoseconds;
  if (age < 0) {
    return {
      Verdict::Uncertain,
      Reason::NegativeAge,
      0,
      std::numeric_limits<std::int64_t>::max()
    };
  }
  return {
    times_out(age, threshold_nanoseconds, comparator)
      ? Verdict::Timeout
      : Verdict::Fresh,
    Reason::SameDomainLocalReceipt,
    age,
    age
  };
}

template <typename SourceDomain, typename TargetDomain>
Result source_event_age(
  Timestamp<TargetDomain, DecisionNow> now,
  Timestamp<SourceDomain, SourceEvent> source_event,
  const RelationCertificate<SourceDomain, TargetDomain>& relation,
  std::int64_t threshold_nanoseconds,
  Comparator comparator
) {
  if (
    relation.valid_from_source_nanoseconds
      > relation.valid_to_source_nanoseconds
    || relation.source_to_target_offset_lower_nanoseconds
      > relation.source_to_target_offset_upper_nanoseconds
  ) {
    return {
      Verdict::Uncertain,
      Reason::InvalidRelation,
      0,
      std::numeric_limits<std::int64_t>::max()
    };
  }
  if (
    source_event.nanoseconds
      < relation.valid_from_source_nanoseconds
    || source_event.nanoseconds
      > relation.valid_to_source_nanoseconds
  ) {
    return {
      Verdict::Uncertain,
      Reason::OutsideValidity,
      0,
      std::numeric_limits<std::int64_t>::max()
    };
  }
  if (source_event.relock_counter != relation.relock_counter) {
    return {
      Verdict::Uncertain,
      Reason::RelockMismatch,
      0,
      std::numeric_limits<std::int64_t>::max()
    };
  }

  const std::int64_t mapped_source_lower =
    source_event.nanoseconds
    + relation.source_to_target_offset_lower_nanoseconds;
  const std::int64_t mapped_source_upper =
    source_event.nanoseconds
    + relation.source_to_target_offset_upper_nanoseconds;
  const std::int64_t raw_age_lower =
    now.nanoseconds - mapped_source_upper;
  const std::int64_t raw_age_upper =
    now.nanoseconds - mapped_source_lower;
  if (raw_age_upper < 0) {
    return {
      Verdict::Uncertain,
      Reason::NegativeAge,
      0,
      std::numeric_limits<std::int64_t>::max()
    };
  }
  const std::int64_t age_lower = std::max<std::int64_t>(
    0,
    raw_age_lower
  );
  return {
    interval_verdict(
      age_lower,
      raw_age_upper,
      threshold_nanoseconds,
      comparator
    ),
    Reason::BoundedClockRelation,
    age_lower,
    raw_age_upper
  };
}

}  // namespace paper_digest::freshness

#endif
