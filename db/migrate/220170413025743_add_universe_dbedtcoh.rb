class AddUniverseDbedtcoh < ActiveRecord::Migration
  def self.up
    change_column :series, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH','UHEROCOH','DBEDTCOH')), null: false, default: 'UHERO'
    change_column :measurements, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH','UHEROCOH','DBEDTCOH')), null: false, default: 'UHERO'
    remove_column :data_points, :restore_counter if column_exists? :data_points, :restore_counter
  end
  def self.down
    change_column :series, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH','UHEROCOH')), null: false, default: 'UHERO'
    change_column :measurements, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
  end
end
