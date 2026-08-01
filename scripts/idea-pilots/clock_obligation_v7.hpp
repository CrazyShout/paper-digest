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
  NegativeAge,
  ArithmeticOverflow
};

struct Result;
template <typename SourceDomain, typename TargetDomain>
class RelationCertificate;

template <typename Domain, typename Origin>
class Timestamp {
 public:
  constexpr Timestamp(
    std::int64_t nanoseconds,
    std::uint64_t relock_counter
  ) : nanoseconds_(nanoseconds), relock_counter_(relock_counter) {}

 private:
  template <typename AnyDomain>
  friend Result since_local_receipt(
    Timestamp<AnyDomain, DecisionNow>,
    Timestamp<AnyDomain, LocalReceipt>,
    std::int64_t,
    Comparator
  );

  template <typename SourceDomain, typename TargetDomain>
  friend Result source_event_age(
    Timestamp<TargetDomain, DecisionNow>,
    Timestamp<SourceDomain, SourceEvent>,
    const RelationCertificate<SourceDomain, TargetDomain>&,
    std::int64_t,
    Comparator
  );

  std::int64_t nanoseconds_;
  std::uint64_t relock_counter_;
};

template <typename SourceDomain, typename TargetDomain>
class RelationCertificate {
 public:
  constexpr RelationCertificate(
    std::int64_t valid_from_source_nanoseconds,
    std::int64_t valid_to_source_nanoseconds,
    std::uint64_t relock_counter,
    std::int64_t source_to_target_offset_lower_nanoseconds,
    std::int64_t source_to_target_offset_upper_nanoseconds
  ) : valid_from_source_nanoseconds_(
        valid_from_source_nanoseconds
      ),
      valid_to_source_nanoseconds_(valid_to_source_nanoseconds),
      relock_counter_(relock_counter),
      source_to_target_offset_lower_nanoseconds_(
        source_to_target_offset_lower_nanoseconds
      ),
      source_to_target_offset_upper_nanoseconds_(
        source_to_target_offset_upper_nanoseconds
      ) {}

 private:
  template <typename AnySourceDomain, typename AnyTargetDomain>
  friend Result source_event_age(
    Timestamp<AnyTargetDomain, DecisionNow>,
    Timestamp<AnySourceDomain, SourceEvent>,
    const RelationCertificate<AnySourceDomain, AnyTargetDomain>&,
    std::int64_t,
    Comparator
  );

  std::int64_t valid_from_source_nanoseconds_;
  std::int64_t valid_to_source_nanoseconds_;
  std::uint64_t relock_counter_;
  std::int64_t source_to_target_offset_lower_nanoseconds_;
  std::int64_t source_to_target_offset_upper_nanoseconds_;
};

struct Result {
  Verdict verdict;
  Reason reason;
  std::int64_t age_lower_nanoseconds;
  std::int64_t age_upper_nanoseconds;
};

inline Result unresolved(Reason reason) {
  return {
    Verdict::Uncertain,
    reason,
    0,
    std::numeric_limits<std::int64_t>::max()
  };
}

inline bool in_int64(__int128 value) {
  return value >= std::numeric_limits<std::int64_t>::min()
    && value <= std::numeric_limits<std::int64_t>::max();
}

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
  if (threshold_nanoseconds < 0) {
    return unresolved(Reason::InvalidRelation);
  }
  const __int128 wide_age =
    static_cast<__int128>(now.nanoseconds_)
    - static_cast<__int128>(receipt.nanoseconds_);
  if (!in_int64(wide_age)) {
    return unresolved(Reason::ArithmeticOverflow);
  }
  const std::int64_t age = static_cast<std::int64_t>(wide_age);
  if (age < 0) {
    return unresolved(Reason::NegativeAge);
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
  if (threshold_nanoseconds < 0) {
    return unresolved(Reason::InvalidRelation);
  }
  if (
    relation.valid_from_source_nanoseconds_
      > relation.valid_to_source_nanoseconds_
    || relation.source_to_target_offset_lower_nanoseconds_
      > relation.source_to_target_offset_upper_nanoseconds_
  ) {
    return unresolved(Reason::InvalidRelation);
  }
  if (
    source_event.nanoseconds_
      < relation.valid_from_source_nanoseconds_
    || source_event.nanoseconds_
      > relation.valid_to_source_nanoseconds_
  ) {
    return unresolved(Reason::OutsideValidity);
  }
  if (source_event.relock_counter_ != relation.relock_counter_) {
    return unresolved(Reason::RelockMismatch);
  }

  const __int128 mapped_source_lower =
    static_cast<__int128>(source_event.nanoseconds_)
    + static_cast<__int128>(
      relation.source_to_target_offset_lower_nanoseconds_
    );
  const __int128 mapped_source_upper =
    static_cast<__int128>(source_event.nanoseconds_)
    + static_cast<__int128>(
      relation.source_to_target_offset_upper_nanoseconds_
    );
  const __int128 raw_age_lower =
    static_cast<__int128>(now.nanoseconds_) - mapped_source_upper;
  const __int128 raw_age_upper =
    static_cast<__int128>(now.nanoseconds_) - mapped_source_lower;
  if (raw_age_upper < 0) {
    return unresolved(Reason::NegativeAge);
  }
  if (!in_int64(raw_age_lower) || !in_int64(raw_age_upper)) {
    return unresolved(Reason::ArithmeticOverflow);
  }
  const std::int64_t age_lower = std::max<std::int64_t>(
    0,
    static_cast<std::int64_t>(raw_age_lower)
  );
  const std::int64_t age_upper =
    static_cast<std::int64_t>(raw_age_upper);
  return {
    interval_verdict(
      age_lower,
      age_upper,
      threshold_nanoseconds,
      comparator
    ),
    Reason::BoundedClockRelation,
    age_lower,
    age_upper
  };
}

}  // namespace paper_digest::freshness

#endif
