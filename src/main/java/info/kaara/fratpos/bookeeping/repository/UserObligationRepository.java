package info.kaara.fratpos.bookeeping.repository;

import info.kaara.fratpos.bookeeping.model.Obligation;
import info.kaara.fratpos.bookeeping.model.UserObligation;
import info.kaara.fratpos.user.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserObligationRepository extends JpaRepository<UserObligation, Long> {

	List<UserObligation> findByUser(User user);

	List<UserObligation> findByObligation(Obligation obligation);
}